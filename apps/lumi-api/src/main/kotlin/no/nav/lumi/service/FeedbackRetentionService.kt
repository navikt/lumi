package no.nav.lumi.service

import no.nav.lumi.config.RetentionObservability
import no.nav.lumi.repository.FeedbackRetentionBatchResult
import no.nav.lumi.repository.FeedbackRetentionRepository
import no.nav.lumi.repository.FeedbackRetentionResult
import no.nav.lumi.repository.FeedbackRetentionSkipReason
import org.slf4j.LoggerFactory
import java.time.Duration

class FeedbackRetentionService(
    private val repository: FeedbackRetentionRepository = FeedbackRetentionRepository(),
    private val observability: RetentionObservability = RetentionObservability(),
    private val statsCacheInvalidator: StatsCacheInvalidator = StatsCacheInvalidator(),
    private val bootstrapCacheInvalidator: BootstrapCacheInvalidator = BootstrapCacheInvalidator(),
    private val batchSize: Int = FeedbackRetentionRepository.MAX_DELETE_BATCH_SIZE,
) {
    private val log = LoggerFactory.getLogger(FeedbackRetentionService::class.java)

    fun runOnce(): FeedbackRetentionResult {
        return try {
            repository.deleteExpiredFeedback(
                retentionMonths = RESPONSE_RETENTION_MONTHS,
                minimumInterval = MINIMUM_RUN_INTERVAL,
                batchSize = batchSize,
            ) { batch ->
                publishCommittedBatch(batch)
            }.also { result ->
                if (result.executed) {
                    val cutoff = checkNotNull(result.cutoff) {
                        "Executed retention result did not include the database cutoff"
                    }
                    val completedAt = checkNotNull(result.lastCompletedAt) {
                        "Executed retention result did not include the database completion time"
                    }
                    observability.recordExecuted(completedAt)
                    log.info(
                        "Automatic retention run completed: deletedFeedback={}, cutoff={}",
                        result.deletedFeedback,
                        cutoff,
                    )
                } else {
                    observability.recordSkipped()
                    result.lastCompletedAt?.let(observability::recordLastSuccess)
                    when (result.skipReason) {
                        FeedbackRetentionSkipReason.LOCK_HELD ->
                            log.info("Automatic retention skipped because another instance holds the cleanup lock")
                        FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED ->
                            log.info(
                                "Automatic retention skipped because the global run interval has not elapsed: " +
                                    "lastCompletedAt={}",
                                result.lastCompletedAt,
                            )
                        null -> log.warn("Automatic retention skipped without a reason")
                    }
                }
            }
        } catch (cause: Throwable) {
            observability.recordFailed()
            log.error("Automatic retention failed", cause)
            throw cause
        }
    }

    private fun publishCommittedBatch(batch: FeedbackRetentionBatchResult) {
        var invalidationFailure: Throwable? = null
        batch.affectedTeams.forEach { team ->
            runCatching { statsCacheInvalidator.invalidateTeam(team) }
                .onFailure { cause ->
                    invalidationFailure = invalidationFailure.append(cause)
                }
            runCatching { bootstrapCacheInvalidator.invalidateTeam(team) }
                .onFailure { cause ->
                    invalidationFailure = invalidationFailure.append(cause)
                }
        }
        observability.recordDeletedFeedback(batch.deletedFeedback)
        invalidationFailure?.let { throw it }
    }

    private fun Throwable?.append(cause: Throwable): Throwable =
        this?.also { it.addSuppressed(cause) } ?: cause

    companion object {
        const val RESPONSE_RETENTION_MONTHS = 12
        const val DEFINITION_WARNING_LEAD_MONTHS = 3L
        val MINIMUM_RUN_INTERVAL: Duration = Duration.ofDays(1)
    }
}
