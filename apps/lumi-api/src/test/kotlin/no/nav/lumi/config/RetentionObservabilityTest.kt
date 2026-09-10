package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeExactly
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import java.time.Instant

class RetentionObservabilityTest : FunSpec({
    test("records bounded retention metrics without team or survey labels") {
        val registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val observability = RetentionObservability(registry)

        observability.recordDeletedFeedback(7)
        observability.recordExecuted(Instant.parse("2026-08-26T12:00:00Z"))
        observability.recordSkipped()
        observability.recordFailed()

        registry.get(RetentionObservability.RUNS_METRIC_NAME)
            .tag("outcome", "executed")
            .counter()
            .count()
            .shouldBeExactly(1.0)
        registry.get(RetentionObservability.DELETED_FEEDBACK_METRIC_NAME)
            .counter()
            .count()
            .shouldBeExactly(7.0)
        registry.get(RetentionObservability.LAST_SUCCESS_METRIC_NAME)
            .gauge()
            .value()
            .shouldBeExactly(1_787_745_600.0)
        registry.get(RetentionObservability.ENABLED_METRIC_NAME)
            .gauge()
            .value()
            .shouldBeExactly(1.0)
        val scrape = registry.scrape()
        scrape shouldContain "lumi_retention_runs_total{outcome=\"failed\"} 1.0"
        scrape shouldContain "lumi_retention_last_success_timestamp_seconds 1.7877456E9"
        scrape shouldNotContain "survey_id"
        scrape shouldNotContain "team="
    }

    test("reports disabled state without running cleanup") {
        val registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)

        RetentionObservability(registry, enabled = false)

        registry.get(RetentionObservability.ENABLED_METRIC_NAME)
            .gauge()
            .value()
            .shouldBeExactly(0.0)
    }

    test("rehydrates last success without recording a new execution") {
        val registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val observability = RetentionObservability(registry)
        val persistedCompletion = Instant.parse("2026-08-29T18:54:24Z")

        observability.recordLastSuccess(persistedCompletion)
        observability.recordLastSuccess(persistedCompletion.minusSeconds(60))

        registry.get(RetentionObservability.LAST_SUCCESS_METRIC_NAME)
            .gauge()
            .value()
            .shouldBeExactly(persistedCompletion.epochSecond.toDouble())
        registry.get(RetentionObservability.RUNS_METRIC_NAME)
            .tag("outcome", "executed")
            .counter()
            .count()
            .shouldBeExactly(0.0)
    }
})
