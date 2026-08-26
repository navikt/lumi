package no.nav.lumi.repository

import no.nav.lumi.config.DatabaseHolder
import java.sql.Connection
import java.sql.Timestamp
import java.time.Instant
import javax.sql.DataSource

data class FeedbackRetentionResult(
    val executed: Boolean,
    val deletedFeedback: Int = 0,
    val affectedTeams: Set<String> = emptySet(),
)

data class FeedbackRetentionBatchResult(
    val deletedFeedback: Int,
    val affectedTeams: Set<String>,
)

class FeedbackRetentionRepository(
    private val dataSource: DataSource = DatabaseHolder.dataSource,
) {
    fun deleteExpiredFeedback(
        cutoff: Instant,
        batchSize: Int,
        onBatchCommitted: (FeedbackRetentionBatchResult) -> Unit = {},
    ): FeedbackRetentionResult {
        require(batchSize > 0) { "batchSize must be greater than zero" }

        return dataSource.connection.use { connection ->
            connection.autoCommit = false
            if (!connection.tryAcquireCleanupLock()) {
                connection.rollback()
                return@use FeedbackRetentionResult(executed = false)
            }

            try {
                var deletedTotal = 0
                val affectedTeams = mutableSetOf<String>()
                do {
                    val deletedBatch = connection.deleteExpiredBatch(cutoff, batchSize)
                    connection.commit()
                    deletedTotal += deletedBatch.deletedFeedback
                    affectedTeams += deletedBatch.affectedTeams
                    if (deletedBatch.deletedFeedback > 0) {
                        onBatchCommitted(deletedBatch)
                    }
                } while (deletedBatch.deletedFeedback == batchSize)

                FeedbackRetentionResult(
                    executed = true,
                    deletedFeedback = deletedTotal,
                    affectedTeams = affectedTeams,
                )
            } catch (cause: Throwable) {
                connection.rollback()
                throw cause
            } finally {
                connection.releaseCleanupLock()
            }
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
        const val CLEANUP_LOCK_ID = 4_861_756_693_849L
    }
}
