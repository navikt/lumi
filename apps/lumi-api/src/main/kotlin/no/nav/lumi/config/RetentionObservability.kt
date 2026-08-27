package no.nav.lumi.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

enum class RetentionRunOutcome(val metricValue: String) {
    EXECUTED("executed"),
    SKIPPED("skipped"),
    FAILED("failed"),
}

class RetentionObservability(
    meterRegistry: MeterRegistry = appMicrometerRegistry,
    enabled: Boolean = true,
) {
    private val runCounters = RetentionRunOutcome.entries.associateWith { outcome ->
        Counter.builder(RUNS_METRIC_NAME)
            .description("Number of automatic retention runs by outcome")
            .tag("outcome", outcome.metricValue)
            .register(meterRegistry)
    }
    private val deletedFeedbackCounter = Counter.builder(DELETED_FEEDBACK_METRIC_NAME)
        .description("Number of feedback rows deleted by automatic retention")
        .register(meterRegistry)
    private val lastSuccessTimestamp = AtomicLong(0)
    private val enabledState = AtomicLong(if (enabled) 1 else 0)

    init {
        Gauge.builder(LAST_SUCCESS_METRIC_NAME, lastSuccessTimestamp) { value -> value.get().toDouble() }
            .description("Unix timestamp of the last successful automatic retention run")
            .baseUnit("seconds")
            .register(meterRegistry)
        Gauge.builder(ENABLED_METRIC_NAME, enabledState) { value -> value.get().toDouble() }
            .description("Whether automatic retention is enabled for this application instance")
            .register(meterRegistry)
    }

    fun recordExecuted(completedAt: Instant) {
        runCounters.getValue(RetentionRunOutcome.EXECUTED).increment()
        lastSuccessTimestamp.set(completedAt.epochSecond)
    }

    fun recordDeletedFeedback(deletedFeedback: Int) {
        require(deletedFeedback >= 0) { "deletedFeedback cannot be negative" }
        deletedFeedbackCounter.increment(deletedFeedback.toDouble())
    }

    fun recordSkipped() {
        runCounters.getValue(RetentionRunOutcome.SKIPPED).increment()
    }

    fun recordFailed() {
        runCounters.getValue(RetentionRunOutcome.FAILED).increment()
    }

    companion object {
        const val RUNS_METRIC_NAME = "lumi_retention_runs_total"
        const val DELETED_FEEDBACK_METRIC_NAME = "lumi_retention_deleted_feedback_total"
        const val LAST_SUCCESS_METRIC_NAME = "lumi_retention_last_success_timestamp_seconds"
        const val ENABLED_METRIC_NAME = "lumi_retention_enabled"
    }
}
