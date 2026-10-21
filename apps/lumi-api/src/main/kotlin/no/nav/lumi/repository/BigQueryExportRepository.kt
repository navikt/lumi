package no.nav.lumi.repository

import com.zaxxer.hikari.HikariDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.BigQueryExportDestination
import no.nav.lumi.domain.BigQueryExportProblemCode
import no.nav.lumi.domain.BigQueryExportRowCounts
import no.nav.lumi.domain.BigQueryExportRunStatus
import no.nav.lumi.domain.BigQueryExportSourceRow
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.slf4j.LoggerFactory
import java.security.SecureRandom
import java.sql.Connection
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import javax.sql.DataSource

/**
 * The global export lock, held by this replica. The snapshot runs on the connection that holds the
 * lock, so a run keeps a single connection from the pool for as long as it lasts.
 */
interface BigQueryExportLock {
    /**
     * Reads the team's stored responses inside the retention window from one consistent snapshot.
     * The cutoff is computed once, with the same expression as the retention job, so rows the job
     * has not deleted yet are still left out.
     */
    suspend fun <T> readExportSnapshot(team: String, retentionMonths: Int, block: suspend (BigQueryExportSnapshot) -> T): T
}

/** The team's stored responses for one export run, read from one consistent snapshot. */
interface BigQueryExportSnapshot {
    /** Streams the responses newest first. */
    suspend fun forEachRow(consumer: suspend (BigQueryExportSourceRow) -> Unit)
}

/**
 * Stores one BigQuery export destination per team and reads the team's responses for an export.
 *
 * The table lives in the `bigquery_export` schema. The broad `esyfo-analyse` role cannot read it.
 */
class BigQueryExportRepository(
    private val dataSourceProvider: () -> DataSource = { DatabaseHolder.dataSource },
    private val random: SecureRandom = SecureRandom(),
) {
    suspend fun find(team: String): BigQueryExportDestination? = dbQuery {
        currentJdbcConnection().prepareStatement("$SELECT_DESTINATION WHERE team = ?").use { statement ->
            statement.setString(1, team)
            statement.executeQuery().use { result -> if (result.next()) result.toDestination() else null }
        }
    }

    suspend fun findAll(): List<BigQueryExportDestination> = dbQuery {
        currentJdbcConnection().prepareStatement("$SELECT_DESTINATION ORDER BY team").use { statement ->
            statement.executeQuery().use { result ->
                buildList { while (result.next()) add(result.toDestination()) }
            }
        }
    }

    /**
     * Creates or updates the team's destination. A new destination gets a new pseudonym key and a
     * queued first run. Changing project or dataset counts as a new destination: it gets a new key,
     * the run history is reset, and a run is queued so the new dataset is filled. Changing free text
     * also queues a run.
     */
    suspend fun upsert(
        team: String,
        projectId: String,
        datasetId: String,
        includeFreeText: Boolean,
        actor: String,
        now: Instant,
    ): BigQueryExportDestination = dbQuery {
        val key = ByteArray(PSEUDONYM_KEY_BYTES).also(random::nextBytes)
        currentJdbcConnection().prepareStatement(
            """
                INSERT INTO bigquery_export.destinations AS d
                    (team, project_id, dataset_id, include_free_text, pseudonym_key,
                     created_by, created_at, updated_by, updated_at, run_requested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (team) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    dataset_id = EXCLUDED.dataset_id,
                    include_free_text = EXCLUDED.include_free_text,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = EXCLUDED.updated_at,
                    pseudonym_key = CASE WHEN $MOVED THEN EXCLUDED.pseudonym_key ELSE d.pseudonym_key END,
                    last_run_started_at = CASE WHEN $MOVED THEN NULL ELSE d.last_run_started_at END,
                    last_run_finished_at = CASE WHEN $MOVED THEN NULL ELSE d.last_run_finished_at END,
                    last_run_status = CASE WHEN $MOVED THEN NULL ELSE d.last_run_status END,
                    last_run_error_code = CASE WHEN $MOVED THEN NULL ELSE d.last_run_error_code END,
                    consecutive_failures = CASE WHEN $MOVED THEN 0 ELSE d.consecutive_failures END,
                    last_success_at = CASE WHEN $MOVED THEN NULL ELSE d.last_success_at END,
                    last_success_rows = CASE WHEN $MOVED THEN NULL ELSE d.last_success_rows END,
                    run_requested_at = CASE
                        WHEN $MOVED OR d.include_free_text <> EXCLUDED.include_free_text
                        THEN COALESCE(d.run_requested_at, EXCLUDED.run_requested_at)
                        ELSE d.run_requested_at
                    END
            """.trimIndent(),
        ).use { statement ->
            val timestamp = Timestamp.from(now)
            statement.setString(1, team)
            statement.setString(2, projectId)
            statement.setString(3, datasetId)
            statement.setBoolean(4, includeFreeText)
            statement.setBytes(5, key)
            statement.setString(6, actor)
            statement.setTimestamp(7, timestamp)
            statement.setString(8, actor)
            statement.setTimestamp(9, timestamp)
            statement.setTimestamp(10, timestamp)
            statement.executeUpdate()
        }
        currentJdbcConnection().prepareStatement("$SELECT_DESTINATION WHERE team = ?").use { statement ->
            statement.setString(1, team)
            statement.executeQuery().use { result ->
                check(result.next()) { "Destination disappeared after upsert" }
                result.toDestination()
            }
        }
    }

    /** Queues a run unless one is already queued. Returns false when the team has no destination. */
    suspend fun requestRun(team: String, now: Instant): Boolean = dbQuery {
        currentJdbcConnection().prepareStatement(
            "UPDATE bigquery_export.destinations SET run_requested_at = COALESCE(run_requested_at, ?) WHERE team = ?",
        ).use { statement ->
            statement.setTimestamp(1, Timestamp.from(now))
            statement.setString(2, team)
            statement.executeUpdate() == 1
        }
    }

    suspend fun delete(team: String): Boolean = dbQuery {
        currentJdbcConnection().prepareStatement(
            "DELETE FROM bigquery_export.destinations WHERE team = ?",
        ).use { statement ->
            statement.setString(1, team)
            statement.executeUpdate() == 1
        }
    }

    /**
     * Marks a run as started and returns the destination as it is now, so the run uses the latest
     * settings. A request made after [startedAt] stays queued for the next run. Returns null when
     * the team has stopped the export.
     */
    suspend fun markStarted(team: String, startedAt: Instant): BigQueryExportDestination? = dbQuery {
        currentJdbcConnection().prepareStatement(
            """
                UPDATE bigquery_export.destinations SET
                    last_run_status = 'RUNNING',
                    last_run_started_at = ?,
                    last_run_finished_at = NULL,
                    last_run_error_code = NULL,
                    run_requested_at = CASE WHEN run_requested_at <= ? THEN NULL ELSE run_requested_at END
                WHERE team = ?
                RETURNING $DESTINATION_COLUMNS
            """.trimIndent(),
        ).use { statement ->
            val timestamp = Timestamp.from(startedAt)
            statement.setTimestamp(1, timestamp)
            statement.setTimestamp(2, timestamp)
            statement.setString(3, team)
            statement.executeQuery().use { result -> if (result.next()) result.toDestination() else null }
        }
    }

    suspend fun markSucceeded(
        team: String,
        startedAt: Instant,
        finishedAt: Instant,
        rows: BigQueryExportRowCounts,
    ): Boolean = dbQuery {
        currentJdbcConnection().prepareStatement(
            """
                UPDATE bigquery_export.destinations SET
                    last_run_status = 'SUCCEEDED',
                    last_run_finished_at = ?,
                    last_run_error_code = NULL,
                    consecutive_failures = 0,
                    last_success_at = ?,
                    last_success_rows = ?::jsonb
                WHERE team = ? AND last_run_started_at = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setTimestamp(1, Timestamp.from(finishedAt))
            statement.setTimestamp(2, Timestamp.from(startedAt))
            statement.setString(3, json.encodeToString(BigQueryExportRowCounts.serializer(), rows))
            statement.setString(4, team)
            statement.setTimestamp(5, Timestamp.from(startedAt))
            statement.executeUpdate() == 1
        }
    }

    suspend fun markFailed(
        team: String,
        startedAt: Instant,
        finishedAt: Instant,
        code: BigQueryExportProblemCode,
    ): Boolean = dbQuery {
        currentJdbcConnection().prepareStatement(
            """
                UPDATE bigquery_export.destinations SET
                    last_run_status = 'FAILED',
                    last_run_finished_at = ?,
                    last_run_error_code = ?,
                    consecutive_failures = consecutive_failures + 1
                WHERE team = ? AND last_run_started_at = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setTimestamp(1, Timestamp.from(finishedAt))
            statement.setString(2, code.name)
            statement.setString(3, team)
            statement.setTimestamp(4, Timestamp.from(startedAt))
            statement.executeUpdate() == 1
        }
    }

    /** Remembers a job that may replace a table, before Lumi starts it. */
    suspend fun addPendingJob(team: String, jobId: String): Unit = dbQuery {
        currentJdbcConnection().prepareStatement(
            """
                UPDATE bigquery_export.destinations
                SET pending_job_ids = array_append(array_remove(pending_job_ids, ?), ?)
                WHERE team = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, jobId)
            statement.setString(2, jobId)
            statement.setString(3, team)
            statement.executeUpdate()
        }
    }

    /** Forgets a job Lumi has seen finish, or that BigQuery never started. */
    suspend fun removePendingJob(team: String, jobId: String): Unit = dbQuery {
        currentJdbcConnection().prepareStatement(
            "UPDATE bigquery_export.destinations SET pending_job_ids = array_remove(pending_job_ids, ?) WHERE team = ?",
        ).use { statement ->
            statement.setString(1, jobId)
            statement.setString(2, team)
            statement.executeUpdate()
        }
    }

    /**
     * Runs [block] while holding the global export lock, so only one replica exports at a time.
     * Returns null without running [block] when another replica holds the lock.
     */
    suspend fun <T> withExportLock(block: suspend (BigQueryExportLock) -> T): T? = withContext(Dispatchers.IO) {
        val dataSource = dataSourceProvider()
        dataSource.connection.use { connection ->
            connection.autoCommit = true
            val acquired = connection.prepareStatement("SELECT pg_try_advisory_lock(?)").use { statement ->
                statement.setLong(1, EXPORT_LOCK_ID)
                statement.executeQuery().use { result -> result.next() && result.getBoolean(1) }
            }
            if (!acquired) return@withContext null
            try {
                block(
                    object : BigQueryExportLock {
                        override suspend fun <T> readExportSnapshot(
                            team: String,
                            retentionMonths: Int,
                            block: suspend (BigQueryExportSnapshot) -> T,
                        ): T = connection.readExportSnapshot(team, retentionMonths, block)
                    },
                )
            } finally {
                val released = runCatching {
                    connection.prepareStatement("SELECT pg_advisory_unlock(?)").use { statement ->
                        statement.setLong(1, EXPORT_LOCK_ID)
                        statement.executeQuery().use { result -> result.next() && result.getBoolean(1) }
                    }
                }.getOrDefault(false)
                if (!released) {
                    // A pooled connection that still holds the lock would block every later export.
                    log.warn("Could not release the BigQuery export lock; evicting the connection")
                    (dataSource as? HikariDataSource)?.evictConnection(connection)
                }
            }
        }
    }

    /**
     * Reads in a read-only REPEATABLE READ transaction on the lock's connection. The advisory lock is
     * held by the session, so it stays when the transaction is rolled back.
     */
    private suspend fun <T> Connection.readExportSnapshot(
        team: String,
        retentionMonths: Int,
        block: suspend (BigQueryExportSnapshot) -> T,
    ): T {
        val connection = this
        connection.autoCommit = false
        connection.transactionIsolation = Connection.TRANSACTION_REPEATABLE_READ
        connection.isReadOnly = true
        try {
            val cutoff = Timestamp.from(connection.retentionCutoff(retentionMonths))
            return block(
                object : BigQueryExportSnapshot {
                    override suspend fun forEachRow(consumer: suspend (BigQueryExportSourceRow) -> Unit) {
                        connection.prepareStatement(SOURCE_ROWS_SQL).use { statement ->
                            statement.fetchSize = SOURCE_FETCH_SIZE
                            statement.queryTimeout = QUERY_TIMEOUT_SECONDS
                            statement.setString(1, team)
                            statement.setTimestamp(2, cutoff)
                            statement.executeQuery().use { result ->
                                while (result.next()) {
                                    consumer(
                                        BigQueryExportSourceRow(
                                            feedbackId = result.getString("id"),
                                            receivedAt = result.getTimestamp("opprettet").toInstant(),
                                            app = result.getString("app"),
                                            surveyId = result.getString("survey_id"),
                                            definitionHash = result.getString("definition_hash"),
                                            surveyArchived = result.getBoolean("survey_archived"),
                                            feedbackJson = result.getString("feedback_json"),
                                        ),
                                    )
                                }
                            }
                        }
                    }
                },
            )
        } finally {
            connection.rollback()
            connection.isReadOnly = false
            connection.transactionIsolation = Connection.TRANSACTION_READ_COMMITTED
            connection.autoCommit = true
        }
    }

    private fun Connection.retentionCutoff(retentionMonths: Int): Instant =
        prepareStatement(
            """
                SELECT (
                    clock_timestamp() AT TIME ZONE 'UTC' - make_interval(months => ?)
                ) AT TIME ZONE 'UTC' AS cutoff
            """.trimIndent(),
        ).use { statement ->
            statement.setInt(1, retentionMonths)
            statement.executeQuery().use { result ->
                check(result.next()) { "Retention cutoff query returned no result" }
                result.getTimestamp("cutoff").toInstant()
            }
        }

    private fun ResultSet.toDestination(): BigQueryExportDestination = BigQueryExportDestination(
        team = getString("team"),
        projectId = getString("project_id"),
        datasetId = getString("dataset_id"),
        includeFreeText = getBoolean("include_free_text"),
        pseudonymKey = getBytes("pseudonym_key"),
        createdAt = getTimestamp("created_at").toInstant(),
        updatedAt = getTimestamp("updated_at").toInstant(),
        runRequestedAt = getTimestamp("run_requested_at")?.toInstant(),
        lastRunStartedAt = getTimestamp("last_run_started_at")?.toInstant(),
        lastRunFinishedAt = getTimestamp("last_run_finished_at")?.toInstant(),
        lastRunStatus = getString("last_run_status")?.let(BigQueryExportRunStatus::valueOf),
        lastRunErrorCode = getString("last_run_error_code")?.let { code ->
            BigQueryExportProblemCode.entries.firstOrNull { it.name == code } ?: BigQueryExportProblemCode.INTERNAL_ERROR
        },
        consecutiveFailures = getInt("consecutive_failures"),
        lastSuccessAt = getTimestamp("last_success_at")?.toInstant(),
        lastSuccessRows = getString("last_success_rows")?.let {
            json.decodeFromString(BigQueryExportRowCounts.serializer(), it)
        },
        pendingJobIds = getArray("pending_job_ids")?.let { (it.array as Array<*>).map { id -> id.toString() } }.orEmpty(),
    )

    private fun currentJdbcConnection(): Connection =
        TransactionManager.current().connection.connection as Connection

    companion object {
        const val PSEUDONYM_KEY_BYTES = 32
        const val EXPORT_LOCK_ID = 7_316_244_190_552L
        private const val SOURCE_FETCH_SIZE = 500

        /** The export's own deadline cannot stop a blocking query, so the database does. */
        private const val QUERY_TIMEOUT_SECONDS = 300
        private val log = LoggerFactory.getLogger(BigQueryExportRepository::class.java)
        private val json = Json { ignoreUnknownKeys = true }

        /** True in the upsert when the team points the export at another project or dataset. */
        private const val MOVED = "(d.project_id <> EXCLUDED.project_id OR d.dataset_id <> EXCLUDED.dataset_id)"

        private const val DESTINATION_COLUMNS =
            "team, project_id, dataset_id, include_free_text, pseudonym_key, created_at, updated_at, " +
                "run_requested_at, last_run_started_at, last_run_finished_at, last_run_status, " +
                "last_run_error_code, consecutive_failures, last_success_at, last_success_rows::text AS last_success_rows, " +
                "pending_job_ids"

        private const val SELECT_DESTINATION = "SELECT $DESTINATION_COLUMNS FROM bigquery_export.destinations"

        private val SOURCE_ROWS_SQL = """
            SELECT f.id,
                   f.opprettet,
                   f.app,
                   COALESCE(NULLIF(f.feedback_json ->> 'surveyId', ''), f.survey_id) AS survey_id,
                   f.definition_hash,
                   (sm.archived_at IS NOT NULL) AS survey_archived,
                   f.feedback_json::text AS feedback_json
            FROM feedback f
            LEFT JOIN survey_metadata sm
                   ON sm.team = f.team
                  AND sm.survey_id = COALESCE(NULLIF(f.feedback_json ->> 'surveyId', ''), f.survey_id)
            WHERE f.team = ?
              AND f.opprettet >= ?
            ORDER BY f.opprettet DESC, f.id DESC
        """.trimIndent()
    }
}
