package no.nav.lumi.service

import no.nav.lumi.config.RetentionObservability
import no.nav.lumi.repository.FeedbackRetentionBatchResult
import no.nav.lumi.repository.FeedbackRetentionRepository
import no.nav.lumi.repository.FeedbackRetentionResult
import no.nav.lumi.repository.FeedbackRetentionSkipReason
import org.slf4j.LoggerFactory
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class FeedbackRetentionService(
    private val repository: FeedbackRetentionRepository = FeedbackRetentionRepository(),
    private val observability: RetentionObservability = RetentionObservability(),
    private val statsCacheInvalidator: StatsCacheInvalidator = StatsCacheInvalidator(),
    private val bootstrapCacheInvalidator: BootstrapCacheInvalidator = BootstrapCacheInvalidator(),
    private val clock: Clock = Clock.systemUTC(),
    private val batchSize: Int = FeedbackRetentionRepository.MAX_DELETE_BATCH_SIZE,
) {
    private val log = LoggerFactory.getLogger(FeedbackRetentionService::class.java)

    fun runOnce(): FeedbackRetentionResult {
        val runAt = Instant.now(clock)
        val cutoff = retentionCutoff(runAt)
        return try {
            repository.deleteExpiredFeedback(
                cutoff = cutoff,
                minimumInterval = MINIMUM_RUN_INTERVAL,
                batchSize = batchSize,
            ) { batch ->
                publishCommittedBatch(batch)
            }.also { result ->
                if (result.executed) {
                    observability.recordExecuted(Instant.now(clock))
                    log.info(
                        "Automatic retention run completed: deletedFeedback={}, cutoff={}",
                        result.deletedFeedback,
                        cutoff,
                    )
                } else {
                    observability.recordSkipped()
                    when (result.skipReason) {
                        FeedbackRetentionSkipReason.LOCK_HELD ->
                            log.info("Automatic retention skipped because another instance holds the cleanup lock")
                        FeedbackRetentionSkipReason.MINIMUM_INTERVAL_NOT_ELAPSED ->
                            log.info("Automatic retention skipped because the global run interval has not elapsed")
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

    internal fun retentionCutoff(now: Instant): Instant =
        now.atZone(ZoneOffset.UTC)
            .minusMonths(RESPONSE_RETENTION_MONTHS)
            .toInstant()

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
        const val RESPONSE_RETENTION_MONTHS = 12L
        const val DEFINITION_WARNING_LEAD_MONTHS = 3L
        val MINIMUM_RUN_INTERVAL: Duration = Duration.ofDays(1)
    }
}
