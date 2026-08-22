package no.nav.lumi.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.NotFoundException
import kotlinx.coroutines.CancellationException
import no.nav.lumi.config.exception.ApiErrorException

enum class SubmissionChannel(val metricValue: String) {
    TOKENX("tokenx"),
    AZURE("azure"),
    INTERNAL_PROXY("internal_proxy")
}

enum class SubmissionMetricOutcome(val metricValue: String) {
    CREATED("created"),
    DUPLICATE("duplicate"),
    REJECTED("rejected"),
    FAILED("failed")
}

class SubmissionObservability(
    meterRegistry: MeterRegistry = appMicrometerRegistry
) {
    private val counters = SubmissionChannel.entries.flatMap { channel ->
        SubmissionMetricOutcome.entries.map { outcome ->
            (channel to outcome) to Counter.builder(METRIC_NAME)
                .description("Number of Lumi survey submissions by channel and outcome")
                .tag("channel", channel.metricValue)
                .tag("outcome", outcome.metricValue)
                .register(meterRegistry)
        }
    }.toMap()

    fun record(channel: SubmissionChannel, outcome: SubmissionMetricOutcome) {
        counters.getValue(channel to outcome).increment()
    }

    suspend fun <T> observeAttempt(
        channel: SubmissionChannel,
        block: suspend () -> T
    ): T = try {
        block()
    } catch (cause: CancellationException) {
        throw cause
    } catch (cause: Throwable) {
        record(channel, cause.toMetricOutcome())
        throw cause
    }

    companion object {
        const val METRIC_NAME = "lumi_submissions_total"
    }
}

private fun Throwable.toMetricOutcome(): SubmissionMetricOutcome = when (this) {
    is ApiErrorException.InternalServerErrorException,
    is ApiErrorException.ServiceUnavailableException -> SubmissionMetricOutcome.FAILED

    is ApiErrorException,
    is BadRequestException,
    is NotFoundException,
    is IllegalArgumentException,
    is IllegalStateException -> SubmissionMetricOutcome.REJECTED

    else -> SubmissionMetricOutcome.FAILED
}
