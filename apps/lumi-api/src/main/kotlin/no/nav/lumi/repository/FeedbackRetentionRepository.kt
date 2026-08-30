package no.nav.lumi.repository

import no.nav.lumi.config.DatabaseHolder
import java.sql.Connection
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant
import javax.sql.DataSource

enum class FeedbackRetentionSkipReason {
    LOCK_HELD,
    MINIMUM_INTERVAL_NOT_ELAPSED,
}

data class FeedbackRetentionResult(
    val executed: Boolean,
    val cutoff: Instant? = null,
    val deletedFeedback: Int = 0,
    val affectedTeams: Set<String> = emptySet(),
    val skipReason: FeedbackRetentionSkipReason? = null,
    val lastCompletedAt: Instant? = null,
)

data class FeedbackRetentionBatchResult(
    val deletedFeedback: Int,
    val affectedTeams: Set<String>,
)

class FeedbackRetentionRepository(
    private val dataSource: DataSource = DatabaseHolder.dataSource,
) {
    fun deleteExpiredFeedback(
        retentionMonths: Int,
        minimumInterval: Duration,
        batchSize: Int,
        onBatchCommitted: (FeedbackRetentionBatchResult) -> Unit = {},
    ): FeedbackRetentionResult {
        require(batchSize in 1..MAX_DELETE_BATCH_SIZE) {
            "batchSize must be between 1 and $MAX_DELETE_BATCH_SIZE"
        }
        require(retentionMonths > 0) { "retentionMonths must be positive" }
        require(!minimumInterval.isNegative && minimumInterval.toMillis() > 0) {
            "minimumInterval must be positive"
        }

        return dataSource.connection.use { connection ->
            connection.autoCommit = false
            if (!connection.tryAcquireCleanupLock()) {
                connection.rollback()
                return@use FeedbackRetentionResult(
                    executed = false,
                    skipReason = FeedbackRetentionSkipReason.LOCK_HELD,
                )
            }

            try {
                val schedule = connection.cleanupSchedule(minimumInterval)
                if (!schedule.due) {
                    connection.rollback()
                    return@use FeedbackRetentionResult(
                        executed = false,
                        skipReason = FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED,
                        lastCompletedAt = schedule.lastCompletedAt,
                    )
                }

                val cutoff = connection.retentionCutoff(retentionMonths)
                val deletedBatch = connection.deleteExpiredBatch(cutoff, batchSize)
                val completedAt = connection.recordCleanupCompleted()
                connection.commit()
                if (deletedBatch.deletedFeedback > 0) {
                    onBatchCommitted(deletedBatch)
                }

                FeedbackRetentionResult(
                    executed = true,
                    cutoff = cutoff,
                    deletedFeedback = deletedBatch.deletedFeedback,
                    affectedTeams = deletedBatch.affectedTeams,
                    lastCompletedAt = completedAt,
                )
            } catch (cause: Throwable) {
                connection.rollback()
                throw cause
            } finally {
                connection.releaseCleanupLock()
            }
        }
    }

    private fun Connection.retentionCutoff(retentionMonths: Int): Instant =
        prepareStatement(
            """
                SELECT (
                    clock_timestamp() AT TIME ZONE 'UTC' - make_interval(months => ?)
                ) AT TIME ZONE 'UTC' AS cutoff
            """.trimIndent()
        ).use { statement ->
            statement.setInt(1, retentionMonths)
            statement.executeQuery().use { result ->
                check(result.next()) { "Retention cutoff query returned no result" }
                result.getTimestamp("cutoff").toInstant()
            }
        }

    private fun Connection.cleanupSchedule(minimumInterval: Duration): CleanupSchedule =
        prepareStatement(
            """
                SELECT
                    last_completed_at,
                    last_completed_at <=
                        clock_timestamp() - (? * INTERVAL '1 millisecond') AS due
                FROM feedback_retention_job_state
                WHERE job_name = ?
            """.trimIndent()
        ).use { statement ->
            statement.setLong(1, minimumInterval.toMillis())
            statement.setString(2, JOB_NAME)
            statement.executeQuery().use { result ->
                if (!result.next()) {
                    CleanupSchedule(due = true)
                } else {
                    CleanupSchedule(
                        due = result.getBoolean("due"),
                        lastCompletedAt = result.getTimestamp("last_completed_at").toInstant(),
                    )
                }
            }
        }

    private fun Connection.recordCleanupCompleted(): Instant =
        prepareStatement(
            """
                INSERT INTO feedback_retention_job_state (job_name, last_completed_at)
                VALUES (?, clock_timestamp())
                ON CONFLICT (job_name) DO UPDATE
                SET last_completed_at = GREATEST(
                    feedback_retention_job_state.last_completed_at,
                    EXCLUDED.last_completed_at
                )
                RETURNING last_completed_at
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, JOB_NAME)
            statement.executeQuery().use { result ->
                check(result.next()) { "Retention job state was not updated" }
                result.getTimestamp("last_completed_at").toInstant()
            }
        }

    private fun Connection.tryAcquireCleanupLock(): Boolean =
        prepareStatement("SELECT pg_try_advisory_lock(?)").use { statement ->
            statement.setLong(1, CLEANUP_LOCK_ID)
            statement.executeQuery().use { result ->
                check(result.next()) { "Retention lock query returned no result" }
                result.getBoolean(1)
            }
        }

    private fun Connection.releaseCleanupLock() {
        prepareStatement("SELECT pg_advisory_unlock(?)").use { statement ->
            statement.setLong(1, CLEANUP_LOCK_ID)
            statement.executeQuery().use { result ->
                check(result.next() && result.getBoolean(1)) {
                    "Retention cleanup lock was not held when release was attempted"
                }
            }
        }
        commit()
    }

    private fun Connection.deleteExpiredBatch(cutoff: Instant, batchSize: Int): FeedbackRetentionBatchResult {
        val sql = """
            WITH expired AS (
                SELECT id
                FROM feedback
                WHERE opprettet < ?
                ORDER BY opprettet, id
                LIMIT ?
                FOR UPDATE SKIP LOCKED
            )
            DELETE FROM feedback
            USING expired
            WHERE feedback.id = expired.id
            RETURNING feedback.team
        """.trimIndent()

        return prepareStatement(sql).use { statement ->
            statement.setTimestamp(1, Timestamp.from(cutoff))
            statement.setInt(2, batchSize)
            statement.executeQuery().use { result ->
                var count = 0
                val affectedTeams = mutableSetOf<String>()
                while (result.next()) {
                    count += 1
                    affectedTeams += result.getString("team")
                }
                FeedbackRetentionBatchResult(count, affectedTeams)
            }
        }
    }

    internal companion object {
        const val JOB_NAME = "feedback-cleanup"
        const val CLEANUP_LOCK_ID = 4_861_756_693_849L
        const val MAX_DELETE_BATCH_SIZE = 500
    }
}

private data class CleanupSchedule(
    val due: Boolean,
    val lastCompletedAt: Instant? = null,
)
