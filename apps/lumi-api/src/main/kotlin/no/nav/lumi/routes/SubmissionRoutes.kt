package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import no.nav.lumi.config.SubmissionRateLimit
import no.nav.lumi.config.UserSubmissionRateLimit
import no.nav.lumi.config.auth.AzureSubmissionAuthPlugin
import no.nav.lumi.config.auth.TokenXSubmissionAuthPlugin
import no.nav.lumi.config.auth.getCallerIdentity
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SurveyDefinitionService
import no.nav.lumi.validation.SubmissionValidator
import org.slf4j.LoggerFactory
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining

private val log = LoggerFactory.getLogger("SubmissionRoutes")
private val defaultFeedbackService = FeedbackService()
private val defaultSurveyDefinitionService = SurveyDefinitionService()

private const val MAX_SUBMISSION_BYTES = 1_048_576L

private val strictJson = Json {
    ignoreUnknownKeys = false
    isLenient = false
    encodeDefaults = true
}

/**
 * Submission routes for feedback collection.
 * 
 * Issuer-specific submission endpoints:
 * - TokenX: /api/tokenx/v1/feedback
 * - AzureAD: /api/azure/v1/feedback
 *
 * The caller's identity (team/app) is extracted from:
 * - TokenX: client_id
 * - AzureAD: azp_name
 * 
 * Rate limited to 100 requests per minute per calling application,
 * and 15 requests per minute per individual user.
 */
fun Route.submissionRoutes(
    feedbackService: FeedbackService = defaultFeedbackService,
    surveyDefinitionService: SurveyDefinitionService = defaultSurveyDefinitionService
) {
    route("/api/tokenx") {
        install(TokenXSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") { handleSubmissionV1(call, feedbackService, surveyDefinitionService) }
            }
        }
    }

    route("/api/azure") {
        install(AzureSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") { handleSubmissionV1(call, feedbackService, surveyDefinitionService) }
            }
        }
    }
}

private suspend fun handleSubmissionV1(
    call: io.ktor.server.application.ApplicationCall,
    feedbackService: FeedbackService,
    surveyDefinitionService: SurveyDefinitionService
) {
    val identity = call.getCallerIdentity()
    val body = receiveTextWithLimit(call)

    val jsonElement = try {
        strictJson.parseToJsonElement(body)
    } catch (e: Exception) {
        log.warn("Invalid JSON in feedback submission from team=${identity.team} app=${identity.app}", e)
        throw ApiErrorException.BadRequestException("Invalid JSON")
    }

    val submission = try {
        strictJson.decodeFromJsonElement(FeedbackSubmissionV1.serializer(), jsonElement)
    } catch (e: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid payload")
    }

    SubmissionValidator.validateSubmissionV1(submission)
    val definitionResult = surveyDefinitionService.registerOrValidate(identity.team, submission)

    val id = feedbackService.save(
        feedbackJson = body,
        team = identity.team,
        app = identity.app,
        surveyId = definitionResult.surveyId,
        definitionHash = definitionResult.definitionHash,
        deduplicationKeyHash = null // Dedup wiring planned for #274 (widget v2)
    )

    log.info(
        "Saved feedback id=$id team=${identity.team} app=${identity.app} surveyId=${submission.surveyId} definitionHash=${definitionResult.definitionHash}"
    )
    call.respond(HttpStatusCode.Created, mapOf("id" to id))
}

private suspend fun receiveTextWithLimit(call: io.ktor.server.application.ApplicationCall): String {
    val contentLength = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
    if (contentLength != null && contentLength > MAX_SUBMISSION_BYTES) {
        throw ApiErrorException.PayloadTooLargeException("Payload too large")
    }

    val packet = call.receiveChannel().readRemaining(MAX_SUBMISSION_BYTES + 1)
    val text = packet.readText()
    if (text.toByteArray().size > MAX_SUBMISSION_BYTES) {
        throw ApiErrorException.PayloadTooLargeException("Payload too large")
    }

    return text
}
