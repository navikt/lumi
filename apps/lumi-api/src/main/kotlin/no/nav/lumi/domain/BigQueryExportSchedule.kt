package no.nav.lumi.domain

import java.time.Duration
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * When a destination should be exported.
 *
 * Every destination is exported once a night after [dailyAt] Norwegian time, and when someone
 * requests a run. After a failed run, Lumi waits one hour, then doubles the wait for each new
 * failure, up to a day. Saving the settings or choosing **Oppdater nå** starts a run at once.
 *
 * 01:00 Norwegian time is outside the Cloud SQL maintenance window (Sunday 01:00–02:00 UTC) both
 * in summer and in winter, and yesterday's responses are complete by then.
 */
class BigQueryExportSchedule(
    private val dailyAt: LocalTime = LocalTime.of(1, 0),
    private val zone: ZoneId = ZoneId.of("Europe/Oslo"),
    private val firstRetryDelay: Duration = Duration.ofHours(1),
    private val maxRetryDelay: Duration = Duration.ofHours(24),
) {
    /**
     * Whether a run should start now. Only call this while holding the export lock: a destination
     * that is still marked as running is then left over from a stopped replica and is due again.
     */
    fun isDue(destination: BigQueryExportDestination, now: Instant): Boolean {
        if (destination.lastRunStatus == BigQueryExportRunStatus.RUNNING) return true
        if (destination.runRequestedAt != null) return true
        if (destination.lastRunStatus == BigQueryExportRunStatus.FAILED) {
            return !now.isBefore(retryAt(destination))
        }
        val lastSuccess = destination.lastSuccessAt ?: return true
        return lastSuccess.isBefore(mostRecentSlot(now))
    }

    /** When the next run is expected to start, for display. */
    fun nextRunAt(destination: BigQueryExportDestination, now: Instant): Instant {
        if (destination.runRequestedAt != null || destination.lastRunStatus == BigQueryExportRunStatus.RUNNING) {
            return now
        }
        val next = when {
            destination.lastRunStatus == BigQueryExportRunStatus.FAILED -> retryAt(destination)
            destination.lastSuccessAt == null -> now
            else -> nextSlotAfter(destination.lastSuccessAt)
        }
        return maxOf(next, now)
    }

    fun mostRecentSlot(now: Instant): Instant {
        val local = now.atZone(zone)
        val today = local.toLocalDate().atTime(dailyAt).atZone(zone).toInstant()
        return if (now.isBefore(today)) {
            local.toLocalDate().minusDays(1).atTime(dailyAt).atZone(zone).toInstant()
        } else {
            today
        }
    }

    fun nextSlotAfter(instant: Instant): Instant {
        val local = instant.atZone(zone)
        val today = local.toLocalDate().atTime(dailyAt).atZone(zone).toInstant()
        return if (instant.isBefore(today)) {
            today
        } else {
            local.toLocalDate().plusDays(1).atTime(dailyAt).atZone(zone).toInstant()
        }
    }

    private fun retryAt(destination: BigQueryExportDestination): Instant {
        val finishedAt = destination.lastRunFinishedAt ?: destination.lastRunStartedAt ?: return Instant.EPOCH
        return finishedAt.plus(retryDelay(destination.consecutiveFailures))
    }

    fun retryDelay(consecutiveFailures: Int): Duration {
        val exponent = (consecutiveFailures - 1).coerceIn(0, MAX_BACKOFF_EXPONENT)
        val delay = firstRetryDelay.multipliedBy(1L shl exponent)
        return if (delay > maxRetryDelay) maxRetryDelay else delay
    }

    private companion object {
        const val MAX_BACKOFF_EXPONENT = 16
    }
}
