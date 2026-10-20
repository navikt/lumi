package no.nav.lumi.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receiveChannel
import io.ktor.server.resources.delete
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import io.ktor.server.resources.put
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import no.nav.lumi.config.BigQueryExportComponents
import no.nav.lumi.config.BigQueryExportRateLimit
import no.nav.lumi.config.auth.authorizedPrincipal
import no.nav.lumi.config.auth.authorizedTeam
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.BigQueryExportDestinationRequest
import no.nav.lumi.domain.BigQueryExportVerifyRequest
import no.nav.lumi.service.BigQueryExportCommandResult
import no.nav.lumi.service.BigQueryExportSaveResult
import no.nav.lumi.service.BigQueryExportService

private val bigQueryExportRequestJson = Json { ignoreUnknownKeys = false }
private const val MAX_BIGQUERY_EXPORT_REQUEST_BYTES = 4096L
internal const val BIGQUERY_EXPORT_UNAVAILABLE_MESSAGE = "BigQuery-eksport er ikke tilgjengelig for teamet i dette miljøet"
internal const val BIGQUERY_EXPORT_NOT_CONFIGURED_MESSAGE = "Teamet har ikke satt opp BigQuery-eksport"

/**
 * Dashboard routes for setting up and following the team's BigQuery export (ADR 0007).
 *
 * Every route needs an explicit `team`. The authorization plugin otherwise falls back to the
 * user's first team, which is fine for reading statistics but not for changing a team's export.
 */
fun Route.bigQueryExportRoutes(
    serviceProvider: () -> BigQueryExportService = { BigQueryExportComponents.service },
) {
    get<ApiV1Intern.BigQueryExport> {
        call.requireExplicitTeam()
        call.respond(serviceProvider().status(call.authorizedTeam))
    }

    rateLimit(BigQueryExportRateLimit) {
        post<ApiV1Intern.BigQueryExport.Verify> {
            call.requireExplicitTeam()
            val request = call.receiveBigQueryExportRequest<BigQueryExportVerifyRequest>()
            val result = serviceProvider().verify(call.authorizedTeam, request.projectId, request.datasetId)
            call.respond(result.orThrow())
        }

        put<ApiV1Intern.BigQueryExport> {
            call.requireExplicitTeam()
            val request = call.receiveBigQueryExportRequest<BigQueryExportDestinationRequest>()
            val actor = stablePrincipalIdentity(call.authorizedPrincipal)
                ?: throw ApiErrorException.BadRequestException("Authenticated user needs a stable identity")
            when (val saved = serviceProvider().save(call.authorizedTeam, actor, request).orThrow()) {
                is BigQueryExportSaveResult.Saved -> call.respond(saved.status)
                is BigQueryExportSaveResult.Rejected -> call.respond(HttpStatusCode.UnprocessableEntity, saved.verification)
            }
        }

        post<ApiV1Intern.BigQueryExport.Run> {
            call.requireExplicitTeam()
            call.respond(HttpStatusCode.Accepted, serviceProvider().requestRun(call.authorizedTeam).orThrow())
        }

        delete<ApiV1Intern.BigQueryExport> {
            call.requireExplicitTeam()
            call.respond(serviceProvider().stop(call.authorizedTeam).orThrow())
        }
    }
}

private fun ApplicationCall.requireExplicitTeam() {
    if (request.queryParameters["team"].isNullOrBlank()) {
        throw ApiErrorException.BadRequestException("The team query parameter is required")
    }
}

private fun <T> BigQueryExportCommandResult<T>.orThrow(): T = when (this) {
    is BigQueryExportCommandResult.Done -> value
    BigQueryExportCommandResult.Unavailable -> throw ApiErrorException.ConflictException(BIGQUERY_EXPORT_UNAVAILABLE_MESSAGE)
    BigQueryExportCommandResult.NotConfigured -> throw ApiErrorException.NotFoundException(BIGQUERY_EXPORT_NOT_CONFIGURED_MESSAGE)
}

private suspend inline fun <reified T> ApplicationCall.receiveBigQueryExportRequest(): T {
    val text = receiveChannel().readRemaining(MAX_BIGQUERY_EXPORT_REQUEST_BYTES + 1).readText()
    if (text.toByteArray(Charsets.UTF_8).size > MAX_BIGQUERY_EXPORT_REQUEST_BYTES) {
        throw ApiErrorException.PayloadTooLargeException("BigQuery export request is too large")
    }
    return try {
        bigQueryExportRequestJson.decodeFromString<T>(text)
    } catch (_: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid BigQuery export request")
    } catch (_: IllegalArgumentException) {
        throw ApiErrorException.BadRequestException("Invalid BigQuery export request")
    }
}
