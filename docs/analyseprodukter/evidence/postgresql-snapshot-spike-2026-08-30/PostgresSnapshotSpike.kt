package no.nav.lumi.prototype.analyticsdb

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.flywaydb.core.Flyway
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.containers.wait.strategy.HostPortWaitStrategy
import java.sql.Connection
import java.sql.DriverManager
import java.time.Duration

private class PrototypePostgresContainer : PostgreSQLContainer<PrototypePostgresContainer>("postgres:17-alpine")

private const val PROTOTYPE_SNAPSHOT_AT = "2026-08-30T10:00:00Z"

data class SnapshotCounts(
    val controlEpoch: Long,
    val rowsByKind: Map<String, Long>,
) {
    val logicalRows: Long = rowsByKind.values.sum()

    fun count(kind: String): Long = rowsByKind[kind] ?: 0L
}

data class QueryPlanObservation(
    val planningTimeMs: Double,
    val executionTimeMs: Double,
    val sharedHitBlocks: Int,
    val sharedReadBlocks: Int,
    val tempReadBlocks: Int,
    val tempWrittenBlocks: Int,
    val feedbackRelationScans: Int,
    val feedbackPlanNodes: List<FeedbackPlanNode>,
    val nodeTypes: Set<String>,
)

data class FeedbackPlanNode(
    val nodeType: String,
    val indexName: String?,
    val actualLoops: Long,
    val actualRowsPerLoop: Long,
) {
    val visitedRows: Long = actualLoops * actualRowsPerLoop
}

data class DatabaseSizeObservation(
    val databaseBytes: Long,
    val feedbackTableBytes: Long,
    val feedbackTotalBytes: Long,
)

data class LoadObservation(
    val label: String,
    val sourceRows: Int,
    val teams: Int,
    val products: Int,
    val overlapPerSource: Int,
    val counts: SnapshotCounts,
    val plan: QueryPlanObservation,
    val size: DatabaseSizeObservation,
    val loadTime: Duration,
)

data class ConsistencyObservation(
    val initialRawFeedbackRows: Long,
    val snapshotControlEpoch: Long,
    val snapshotSubmissionRows: Long,
    val committedRawFeedbackRows: Long,
    val committedControlEpoch: Long,
    val committedSubmissionRows: Long,
)

data class VerificationResult(
    val name: String,
    val passed: Boolean,
    val detail: String,
)

class PostgresSnapshotSpike : AutoCloseable {
    private val container = PrototypePostgresContainer().apply {
        withDatabaseName("lumi_snapshot_prototype")
        withUsername("prototype")
        withPassword("prototype")
        withReuse(false)
        setWaitStrategy(HostPortWaitStrategy())
        start()
    }

    val postgresVersion: String

    init {
        Flyway.configure()
            .dataSource(container.jdbcUrl, container.username, container.password)
            .locations("classpath:db/migration")
            .cleanDisabled(false)
            .load()
            .migrate()
        connection().use { connection ->
            connection.createStatement().use { statement ->
                statement.execute(SCRATCH_SCHEMA_SQL)
            }
        }
        postgresVersion = connection().use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery("SHOW server_version").use { result ->
                    check(result.next())
                    result.getString(1)
                }
            }
        }
    }

    fun verifyConsistency(): ConsistencyObservation {
        seedTinyConsistencyFixture()
        val reader = connection().apply {
            transactionIsolation = Connection.TRANSACTION_REPEATABLE_READ
            isReadOnly = true
            autoCommit = false
        }
        try {
            val initialRawCount = scalarLong(reader, "SELECT count(*) FROM feedback")
            check(initialRawCount == 2L)

            connection().use { writer ->
                writer.autoCommit = false
                writer.createStatement().use { statement ->
                    statement.executeUpdate("DELETE FROM feedback WHERE id = 'prototype-feedback-0'")
                    statement.executeUpdate(
                        """
                        INSERT INTO feedback (id, opprettet, feedback_json, team, app, survey_id)
                        VALUES
                             ('prototype-feedback-2', '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - interval '1 minute',
                             '${feedbackJson(4)}'::jsonb, 'team-0', 'app-0', 'survey-0'),
                            ('prototype-feedback-3', '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - interval '2 minutes',
                             '${feedbackJson(2)}'::jsonb, 'team-0', 'app-0', 'survey-0')
                        """.trimIndent(),
                    )
                    statement.executeUpdate(
                        """
                        INSERT INTO prototype_analysis_snapshot.effective_generation (
                            generation_id, product_id, team, generation, control_epoch,
                            lifecycle_mode, retention_days, data_cutoff_at
                        ) VALUES ('team-0-product-0-g2', 'team-0-product-0', 'team-0', 2, 2,
                                  'OFFBOARDING', 365, NULL)
                        """.trimIndent(),
                    )
                }
                writer.commit()
            }

            val oldSnapshot = executeSnapshotQuery(reader)
            check(oldSnapshot.controlEpoch == 1L)
            check(oldSnapshot.count("SUBMISSION") == 2L)
            reader.commit()

            val committedSnapshot = readSnapshot()
            val committedRawCount = connection().use { scalarLong(it, "SELECT count(*) FROM feedback") }
            return ConsistencyObservation(
                initialRawFeedbackRows = initialRawCount,
                snapshotControlEpoch = oldSnapshot.controlEpoch,
                snapshotSubmissionRows = oldSnapshot.count("SUBMISSION"),
                committedRawFeedbackRows = committedRawCount,
                committedControlEpoch = committedSnapshot.controlEpoch,
                committedSubmissionRows = committedSnapshot.count("SUBMISSION"),
            )
        } finally {
            reader.close()
        }
    }

    fun runLoadScenario(
        label: String,
        sourceRows: Int,
        overlapPerSource: Int,
    ): LoadObservation {
        require(overlapPerSource == 2 || overlapPerSource == 10)
        val startedAt = System.nanoTime()
        seedScaleFixture(sourceRows, overlapPerSource)
        val loadTime = Duration.ofNanos(System.nanoTime() - startedAt)
        val plan = explainSnapshotQuery()
        val counts = readSnapshot()
        val size = readDatabaseSizes()
        val expectedLogicalRows = 2_001L + sourceRows.toLong() * (overlapPerSource + 3L)

        check(counts.count("SNAPSHOT") == 1L)
        check(counts.count("RELEASE_SCOPE") == 500L)
        check(counts.count("SOURCE_ALLOWLIST") == 500L)
        check(counts.count("FIELD_ALLOWLIST") == 500L)
        check(counts.count("DIMENSION_ALLOWLIST") == 500L)
        check(counts.count("SUBMISSION") == sourceRows.toLong())
        check(counts.count("MEMBERSHIP") == sourceRows.toLong() * overlapPerSource)
        check(counts.count("ANSWER_ATOM") == sourceRows.toLong())
        check(counts.count("DIMENSION_VALUE") == sourceRows.toLong())
        check(counts.logicalRows == expectedLogicalRows)
        check(plan.feedbackRelationScans == 2) {
            "expected two bounded feedback plan nodes, got ${plan.feedbackRelationScans}"
        }
        check(
            plan.feedbackPlanNodes.all { node ->
                node.nodeType == "Seq Scan" &&
                    node.actualLoops == 1L &&
                    node.actualRowsPerLoop == sourceRows.toLong()
            },
        ) {
            "expected two single-loop sequential feedback scans, got ${plan.feedbackPlanNodes}"
        }

        return LoadObservation(
            label = label,
            sourceRows = sourceRows,
            teams = 50,
            products = 500,
            overlapPerSource = overlapPerSource,
            counts = counts,
            plan = plan,
            size = size,
            loadTime = loadTime,
        )
    }

    fun runAllVerifications(): Pair<List<VerificationResult>, List<LoadObservation>> {
        val checks = mutableListOf<VerificationResult>()
        val consistency = runCatching { verifyConsistency() }
        checks += consistency.fold(
            onSuccess = { observation ->
                VerificationResult(
                    "repeatable-read snapshot remains internally consistent",
                    observation.initialRawFeedbackRows == 2L &&
                        observation.snapshotControlEpoch == 1L &&
                        observation.snapshotSubmissionRows == 2L &&
                        observation.committedRawFeedbackRows == 3L &&
                        observation.committedControlEpoch == 2L &&
                        observation.committedSubmissionRows == 0L,
                    "reader kept epoch 1 / 2 rows while committed state advanced to epoch 2 / 0 readable rows",
                )
            },
            onFailure = { error ->
                VerificationResult(
                    "repeatable-read snapshot remains internally consistent",
                    false,
                    error.message ?: error::class.simpleName.orEmpty(),
                )
            },
        )

        val loads = listOf(
            runLoadScenario("1x representative overlap", 27_571, 2),
            runLoadScenario("10x representative overlap", 275_710, 2),
            runLoadScenario("10x worst allowed overlap", 275_710, 10),
        )
        loads.forEach { observation ->
            checks += VerificationResult(
                "${observation.label} cardinality and source-scan shape",
                true,
                "${observation.counts.logicalRows} logical rows; " +
                    "${observation.plan.feedbackRelationScans} single-loop sequential feedback nodes",
            )
        }
        return checks to loads
    }

    fun readSnapshot(): SnapshotCounts = readOnlyRepeatableRead { executeSnapshotQuery(it) }

    fun explainSnapshotQuery(): QueryPlanObservation = readOnlyRepeatableRead { connection ->
        connection.createStatement().use { statement ->
            statement.execute("SET LOCAL statement_timeout = '60s'")
            statement.executeQuery(
                "EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON, TIMING OFF) $SNAPSHOT_QUERY",
            ).use { result ->
                check(result.next())
                parsePlan(result.getString(1))
            }
        }
    }

    fun readDatabaseSizes(): DatabaseSizeObservation = connection().use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery(
                """
                SELECT
                    pg_database_size(current_database()),
                    pg_relation_size('feedback'),
                    pg_total_relation_size('feedback')
                """.trimIndent(),
            ).use { result ->
                check(result.next())
                DatabaseSizeObservation(result.getLong(1), result.getLong(2), result.getLong(3))
            }
        }
    }

    override fun close() {
        container.stop()
    }

    private fun seedTinyConsistencyFixture() {
        resetFixtureTables()
        connection().use { connection ->
            connection.autoCommit = false
            connection.createStatement().use { statement ->
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.effective_generation (
                        generation_id, product_id, team, generation, control_epoch,
                        lifecycle_mode, retention_days, data_cutoff_at
                    ) VALUES ('team-0-product-0-g1', 'team-0-product-0', 'team-0', 1, 1,
                              'ACTIVE', 365, NULL)
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.source_atom
                        (generation_id, app, survey_id, membership_allowed)
                    VALUES ('team-0-product-0-g1', 'app-0', 'survey-0', TRUE)
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.field_atom
                        (generation_id, app, survey_id, field_id)
                    VALUES ('team-0-product-0-g1', 'app-0', 'survey-0', 'rating')
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.dimension_atom
                        (generation_id, dimension_key)
                    VALUES ('team-0-product-0-g1', 'deviceType')
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO feedback (id, opprettet, feedback_json, team, app, survey_id)
                    VALUES
                        ('prototype-feedback-0', '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - interval '3 minutes',
                         '${feedbackJson(5)}'::jsonb, 'team-0', 'app-0', 'survey-0'),
                        ('prototype-feedback-1', '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - interval '2 minutes',
                         '${feedbackJson(3)}'::jsonb, 'team-0', 'app-0', 'survey-0')
                    """.trimIndent(),
                )
            }
            connection.commit()
        }
    }

    private fun seedScaleFixture(sourceRows: Int, overlapPerSource: Int) {
        resetFixtureTables()
        connection().use { connection ->
            connection.autoCommit = false
            connection.createStatement().use { statement ->
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.effective_generation (
                        generation_id, product_id, team, generation, control_epoch,
                        lifecycle_mode, retention_days, data_cutoff_at
                    )
                    SELECT
                        format('team-%s-product-%s-g1', team_index, product_index),
                        format('team-%s-product-%s', team_index, product_index),
                        format('team-%s', team_index),
                        1,
                        row_number() OVER (ORDER BY team_index, product_index),
                        'ACTIVE',
                        365,
                        NULL
                    FROM generate_series(0, 49) AS team_index
                    CROSS JOIN generate_series(0, 9) AS product_index
                    """.trimIndent(),
                )
                val surveyExpression = if (overlapPerSource == 10) "0" else "product_index % 5"
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.source_atom
                        (generation_id, app, survey_id, membership_allowed)
                    SELECT
                        format('team-%s-product-%s-g1', team_index, product_index),
                        format('app-%s', team_index),
                        format('survey-%s', $surveyExpression),
                        TRUE
                    FROM generate_series(0, 49) AS team_index
                    CROSS JOIN generate_series(0, 9) AS product_index
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.field_atom
                        (generation_id, app, survey_id, field_id)
                    SELECT generation_id, app, survey_id, 'rating'
                    FROM prototype_analysis_snapshot.source_atom
                    """.trimIndent(),
                )
                statement.executeUpdate(
                    """
                    INSERT INTO prototype_analysis_snapshot.dimension_atom
                        (generation_id, dimension_key)
                    SELECT generation_id, 'deviceType'
                    FROM prototype_analysis_snapshot.effective_generation
                    """.trimIndent(),
                )

                val feedbackSurveyExpression = if (overlapPerSource == 10) "0" else "(row_index / 50) % 5"
                statement.execute("ALTER TABLE feedback DISABLE TRIGGER USER")
                statement.executeUpdate(
                    """
                    INSERT INTO feedback (
                        id, opprettet, feedback_json, team, app, survey_id
                    )
                    SELECT
                        format('prototype-feedback-%s', row_index),
                        '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - make_interval(secs => (row_index % 86400)::double precision),
                        jsonb_build_object(
                            'surveyId', format('survey-%s', $feedbackSurveyExpression),
                            'surveyType', 'RATING',
                            'context', jsonb_build_object(
                                'deviceType', CASE WHEN row_index % 2 = 0 THEN 'mobile' ELSE 'desktop' END,
                                'pathname', '/forbidden-prototype-path'
                            ),
                            'answers', jsonb_build_array(
                                jsonb_build_object(
                                    'id', 'rating',
                                    'value', jsonb_build_object('type', 'rating', 'rating', row_index % 6)
                                ),
                                jsonb_build_object(
                                    'id', 'free-text',
                                    'value', jsonb_build_object('type', 'text', 'text', 'forbidden-prototype-text')
                                )
                            )
                        ),
                        format('team-%s', row_index % 50),
                        format('app-%s', row_index % 50),
                        format('survey-%s', $feedbackSurveyExpression)
                    FROM generate_series(0, ${sourceRows - 1}) AS row_index
                    """.trimIndent(),
                )
                statement.execute("ALTER TABLE feedback ENABLE TRIGGER USER")
            }
            connection.commit()
        }
        connection().use { connection ->
            connection.createStatement().use { statement ->
                statement.execute("ANALYZE feedback")
                statement.execute("ANALYZE prototype_analysis_snapshot.effective_generation")
                statement.execute("ANALYZE prototype_analysis_snapshot.source_atom")
                statement.execute("ANALYZE prototype_analysis_snapshot.field_atom")
                statement.execute("ANALYZE prototype_analysis_snapshot.dimension_atom")
            }
        }
    }

    private fun resetFixtureTables() {
        connection().use { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    TRUNCATE TABLE
                        prototype_analysis_snapshot.dimension_atom,
                        prototype_analysis_snapshot.field_atom,
                        prototype_analysis_snapshot.source_atom,
                        prototype_analysis_snapshot.effective_generation,
                        feedback
                    CASCADE
                    """.trimIndent(),
                )
            }
        }
    }

    private fun executeSnapshotQuery(connection: Connection): SnapshotCounts {
        connection.createStatement().use { statement ->
            statement.execute("SET LOCAL statement_timeout = '60s'")
            statement.executeQuery(SNAPSHOT_QUERY).use { result ->
                var controlEpoch = 0L
                val rows = linkedMapOf<String, Long>()
                while (result.next()) {
                    controlEpoch = result.getLong("control_epoch")
                    rows[result.getString("row_kind")] = result.getLong("row_count")
                }
                return SnapshotCounts(controlEpoch, rows)
            }
        }
    }

    private fun parsePlan(rawPlan: String): QueryPlanObservation {
        val document = Json.parseToJsonElement(rawPlan).jsonArray.first().jsonObject
        val root = document.getValue("Plan").jsonObject
        val nodeTypes = linkedSetOf<String>()
        val feedbackPlanNodes = mutableListOf<FeedbackPlanNode>()

        fun visit(node: JsonObject) {
            node["Node Type"]?.jsonPrimitive?.content?.let(nodeTypes::add)
            if (node["Relation Name"]?.jsonPrimitive?.content == "feedback") {
                feedbackPlanNodes += FeedbackPlanNode(
                    nodeType = node.getValue("Node Type").jsonPrimitive.content,
                    indexName = node["Index Name"]?.jsonPrimitive?.content,
                    actualLoops = node["Actual Loops"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L,
                    actualRowsPerLoop = node["Actual Rows"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0L,
                )
            }
            (node["Plans"] as? JsonArray)?.forEach { visit(it.jsonObject) }
        }
        visit(root)

        return QueryPlanObservation(
            planningTimeMs = document.getValue("Planning Time").jsonPrimitive.double,
            executionTimeMs = document.getValue("Execution Time").jsonPrimitive.double,
            sharedHitBlocks = root.intMetric("Shared Hit Blocks"),
            sharedReadBlocks = root.intMetric("Shared Read Blocks"),
            tempReadBlocks = root.intMetric("Temp Read Blocks"),
            tempWrittenBlocks = root.intMetric("Temp Written Blocks"),
            feedbackRelationScans = feedbackPlanNodes.size,
            feedbackPlanNodes = feedbackPlanNodes,
            nodeTypes = nodeTypes,
        )
    }

    private fun <T> readOnlyRepeatableRead(block: (Connection) -> T): T =
        connection().use { connection ->
            connection.transactionIsolation = Connection.TRANSACTION_REPEATABLE_READ
            connection.isReadOnly = true
            connection.autoCommit = false
            try {
                block(connection).also { connection.commit() }
            } catch (error: Throwable) {
                connection.rollback()
                throw error
            }
        }

    private fun connection(): Connection = DriverManager.getConnection(
        container.jdbcUrl,
        container.username,
        container.password,
    )

    private fun scalarLong(connection: Connection, sql: String): Long =
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { result ->
                check(result.next())
                result.getLong(1)
            }
        }

    private fun JsonObject.intMetric(name: String): Int = this[name]?.jsonPrimitive?.int ?: 0

    companion object {
        private fun feedbackJson(rating: Int): String =
            """{"surveyId":"survey-0","surveyType":"RATING","context":{"deviceType":"mobile"},"answers":[{"id":"rating","value":{"type":"rating","rating":$rating}}]}"""
    }
}

private const val SCRATCH_SCHEMA_SQL = """
    DROP SCHEMA IF EXISTS prototype_analysis_snapshot CASCADE;
    CREATE SCHEMA prototype_analysis_snapshot;

    CREATE TABLE prototype_analysis_snapshot.effective_generation (
        generation_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        team TEXT NOT NULL,
        generation BIGINT NOT NULL CHECK (generation > 0),
        control_epoch BIGINT NOT NULL UNIQUE CHECK (control_epoch > 0),
        lifecycle_mode TEXT NOT NULL CHECK (lifecycle_mode IN ('ACTIVE', 'PAUSED', 'OFFBOARDING')),
        retention_days INTEGER NOT NULL CHECK (retention_days > 0),
        data_cutoff_at TIMESTAMPTZ,
        UNIQUE (product_id, generation)
    );

    CREATE INDEX idx_prototype_generation_latest
        ON prototype_analysis_snapshot.effective_generation(team, product_id, control_epoch DESC);

    CREATE TABLE prototype_analysis_snapshot.source_atom (
        generation_id TEXT NOT NULL REFERENCES prototype_analysis_snapshot.effective_generation(generation_id),
        app TEXT NOT NULL,
        survey_id TEXT NOT NULL,
        membership_allowed BOOLEAN NOT NULL,
        PRIMARY KEY (generation_id, app, survey_id)
    );

    CREATE INDEX idx_prototype_source_lookup
        ON prototype_analysis_snapshot.source_atom(app, survey_id, generation_id)
        WHERE membership_allowed;

    CREATE TABLE prototype_analysis_snapshot.field_atom (
        generation_id TEXT NOT NULL REFERENCES prototype_analysis_snapshot.effective_generation(generation_id),
        app TEXT NOT NULL,
        survey_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        PRIMARY KEY (generation_id, app, survey_id, field_id)
    );

    CREATE TABLE prototype_analysis_snapshot.dimension_atom (
        generation_id TEXT NOT NULL REFERENCES prototype_analysis_snapshot.effective_generation(generation_id),
        dimension_key TEXT NOT NULL,
        PRIMARY KEY (generation_id, dimension_key)
    );
"""
private const val SNAPSHOT_QUERY = """
    WITH latest_generation AS MATERIALIZED (
        SELECT DISTINCT ON (team, product_id)
            generation_id,
            product_id,
            team,
            control_epoch,
            lifecycle_mode,
            retention_days,
            data_cutoff_at
        FROM prototype_analysis_snapshot.effective_generation
        ORDER BY team, product_id, control_epoch DESC
    ),
    readable_generation AS MATERIALIZED (
        SELECT *
        FROM latest_generation
        WHERE lifecycle_mode IN ('ACTIVE', 'PAUSED')
    ),
    current_source AS MATERIALIZED (
        SELECT
            generation.generation_id,
            generation.product_id,
            generation.team,
            generation.control_epoch,
            generation.retention_days,
            generation.data_cutoff_at,
            source.app,
            source.survey_id
        FROM readable_generation AS generation
        JOIN prototype_analysis_snapshot.source_atom AS source
          ON source.generation_id = generation.generation_id
         AND source.membership_allowed
    ),
    current_field AS MATERIALIZED (
        SELECT field.*
        FROM prototype_analysis_snapshot.field_atom AS field
        JOIN readable_generation AS generation
          ON generation.generation_id = field.generation_id
    ),
    current_dimension AS MATERIALIZED (
        SELECT dimension.*
        FROM prototype_analysis_snapshot.dimension_atom AS dimension
        JOIN readable_generation AS generation
          ON generation.generation_id = dimension.generation_id
    ),
    selected_field_policy AS MATERIALIZED (
        SELECT DISTINCT
            source.team,
            source.app,
            source.survey_id,
            field.field_id,
            source.retention_days,
            source.data_cutoff_at
        FROM current_source AS source
        JOIN current_field AS field
          ON field.generation_id = source.generation_id
         AND field.app = source.app
         AND field.survey_id = source.survey_id
    ),
    selected_dimension_policy AS MATERIALIZED (
        SELECT DISTINCT
            source.team,
            source.app,
            source.survey_id,
            dimension.dimension_key,
            source.retention_days,
            source.data_cutoff_at
        FROM current_source AS source
        JOIN current_dimension AS dimension
          ON dimension.generation_id = source.generation_id
    ),
    eligible_submission AS MATERIALIZED (
        SELECT
            row_number() OVER () AS snapshot_row_ref,
            feedback.id AS transient_internal_id,
            feedback.team,
            feedback.app,
            COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId') AS survey_id,
            feedback.opprettet,
            feedback.feedback_json -> 'context' ->> 'deviceType' AS device_type
        FROM feedback
        WHERE EXISTS (
            SELECT 1
            FROM current_source AS source
            WHERE source.team = feedback.team
              AND source.app = feedback.app
              AND source.survey_id = COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId')
              AND feedback.opprettet >=
                  '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - make_interval(days => source.retention_days)
            AND feedback.opprettet <= COALESCE(source.data_cutoff_at, '$PROTOTYPE_SNAPSHOT_AT'::timestamptz)
        )
    ),
    feedback_answer AS MATERIALIZED (
        SELECT
            feedback.id AS transient_internal_id,
            feedback.team,
            feedback.app,
            COALESCE(feedback.survey_id, feedback.feedback_json ->> 'surveyId') AS survey_id,
            feedback.opprettet,
            answer.value ->> 'id' AS field_id,
            answer.value -> 'value' ->> 'type' AS answer_type
        FROM feedback
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(feedback.feedback_json -> 'answers', '[]'::jsonb)
        ) AS answer(value)
        WHERE answer.value -> 'value' ->> 'type' IN ('rating', 'singleChoice', 'multiChoice')
    ),
    selected_answer AS (
        SELECT DISTINCT
            answer.transient_internal_id,
            answer.field_id
        FROM feedback_answer AS answer
        JOIN selected_field_policy AS selected
          ON selected.team = answer.team
         AND selected.app = answer.app
         AND selected.survey_id = answer.survey_id
         AND answer.field_id = selected.field_id
         AND answer.opprettet >=
             '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - make_interval(days => selected.retention_days)
         AND answer.opprettet <= COALESCE(
             selected.data_cutoff_at,
             '$PROTOTYPE_SNAPSHOT_AT'::timestamptz
         )
    ),
    membership AS (
        SELECT submission.snapshot_row_ref, source.generation_id, source.product_id
        FROM eligible_submission AS submission
        JOIN current_source AS source
          ON source.team = submission.team
         AND source.app = submission.app
         AND source.survey_id = submission.survey_id
         AND submission.opprettet >=
             '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - make_interval(days => source.retention_days)
         AND submission.opprettet <= COALESCE(source.data_cutoff_at, '$PROTOTYPE_SNAPSHOT_AT'::timestamptz)
    ),
    answer_atom AS (
        SELECT submission.snapshot_row_ref, answer.field_id
        FROM eligible_submission AS submission
        JOIN selected_answer AS answer
          ON answer.transient_internal_id = submission.transient_internal_id
    ),
    dimension_value AS (
        SELECT DISTINCT submission.snapshot_row_ref, selected.dimension_key
        FROM eligible_submission AS submission
        JOIN selected_dimension_policy AS selected
          ON selected.team = submission.team
         AND selected.app = submission.app
         AND selected.survey_id = submission.survey_id
         AND submission.opprettet >=
             '$PROTOTYPE_SNAPSHOT_AT'::timestamptz - make_interval(days => selected.retention_days)
         AND submission.opprettet <= COALESCE(
             selected.data_cutoff_at,
             '$PROTOTYPE_SNAPSHOT_AT'::timestamptz
         )
        WHERE selected.dimension_key = 'deviceType'
          AND submission.device_type IS NOT NULL
    ),
    logical_row AS (
        SELECT 'SNAPSHOT'::text AS row_kind
        UNION ALL
        SELECT 'RELEASE_SCOPE' FROM readable_generation
        UNION ALL
        SELECT 'SOURCE_ALLOWLIST' FROM current_source
        UNION ALL
        SELECT 'FIELD_ALLOWLIST' FROM current_field
        UNION ALL
        SELECT 'DIMENSION_ALLOWLIST' FROM current_dimension
        UNION ALL
        SELECT 'MEMBERSHIP' FROM membership
        UNION ALL
        SELECT 'SUBMISSION' FROM eligible_submission
        UNION ALL
        SELECT 'ANSWER_ATOM' FROM answer_atom
        UNION ALL
        SELECT 'DIMENSION_VALUE' FROM dimension_value
    ),
    row_count AS (
        SELECT row_kind, count(*) AS row_count
        FROM logical_row
        GROUP BY row_kind
    )
    SELECT
        COALESCE((SELECT max(control_epoch) FROM latest_generation), 0) AS control_epoch,
        row_kind,
        row_count
    FROM row_count
    ORDER BY row_kind
"""
