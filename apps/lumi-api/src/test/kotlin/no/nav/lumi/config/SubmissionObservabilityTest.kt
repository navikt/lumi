package no.nav.lumi.config

import io.kotest.core.spec.style.FunSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.doubles.shouldBeExactly
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import no.nav.lumi.config.exception.ApiErrorException

class SubmissionObservabilityTest : FunSpec({
    test("counts submission outcomes with bounded channel and outcome labels") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val observability = SubmissionObservability(meterRegistry)

        observability.record(SubmissionChannel.TOKENX, SubmissionMetricOutcome.CREATED)
        observability.record(SubmissionChannel.AZURE, SubmissionMetricOutcome.DUPLICATE)
        observability.record(SubmissionChannel.INTERNAL_PROXY, SubmissionMetricOutcome.REJECTED)
        observability.record(SubmissionChannel.TOKENX, SubmissionMetricOutcome.FAILED)

        meterRegistry.get(SubmissionObservability.METRIC_NAME)
            .tag("channel", "tokenx")
            .tag("outcome", "created")
            .counter()
            .count()
            .shouldBeExactly(1.0)

        val scrape = meterRegistry.scrape()
        scrape shouldContain "channel=\"azure\",outcome=\"duplicate\""
        scrape shouldContain "channel=\"internal_proxy\",outcome=\"rejected\""
        scrape shouldContain "channel=\"tokenx\",outcome=\"failed\""
        scrape shouldNotContain "survey_id"
        scrape shouldNotContain "team="
        scrape shouldNotContain "app="
    }

    test("classifies rejected and failed attempts") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val observability = SubmissionObservability(meterRegistry)

        shouldThrow<ApiErrorException.BadRequestException> {
            observability.observeAttempt(SubmissionChannel.AZURE) {
                throw ApiErrorException.BadRequestException("invalid payload")
            }
        }
        shouldThrow<RuntimeException> {
            observability.observeAttempt(SubmissionChannel.AZURE) {
                throw RuntimeException("database unavailable")
            }
        }
        shouldThrow<IllegalArgumentException> {
            observability.observeAttempt(SubmissionChannel.AZURE) {
                throw IllegalArgumentException("broken server invariant")
            }
        }
        shouldThrow<IllegalStateException> {
            observability.observeAttempt(SubmissionChannel.AZURE) {
                throw IllegalStateException("unexpected server state")
            }
        }

        meterRegistry.get(SubmissionObservability.METRIC_NAME)
            .tag("channel", "azure")
            .tag("outcome", "rejected")
            .counter()
            .count()
            .shouldBeExactly(1.0)
        meterRegistry.get(SubmissionObservability.METRIC_NAME)
            .tag("channel", "azure")
            .tag("outcome", "failed")
            .counter()
            .count()
            .shouldBeExactly(3.0)
    }
})
