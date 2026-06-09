package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.MissingFieldException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.Json
import no.nav.lumi.config.SubmissionRateLimit
import no.nav.lumi.config.UserSubmissionRateLimit
import no.nav.lumi.config.auth.AzureSubmissionAuthPlugin
import no.nav.lumi.config.auth.TokenXSubmissionAuthPlugin
import no.nav.lumi.config.auth.getCallerIdentity
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FeedbackSubmissionV2
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.service.SurveyDefinitionService
import no.nav.lumi.validation.SubmissionValidator
import no.nav.lumi.validation.SubmissionV2Validator
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
    surveyDefinitionService: SurveyDefinitionService = defaultSurveyDefinitionService,
    submissionService: SubmissionService = SubmissionService(feedbackService, surveyDefinitionService)
) {
    route("/api/tokenx") {
        install(TokenXSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") { handleSubmission(call, submissionService) }
            }
        }
    }

    route("/api/azure") {
        install(AzureSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") { handleSubmission(call, submissionService) }
            }
        }
    }
}

private suspend fun handleSubmission(
    call: io.ktor.server.application.ApplicationCall,
    submissionService: SubmissionService
) {
    val identity = call.getCallerIdentity()
    val body = receiveTextWithLimit(call)

    val jsonElement = try {
        strictJson.parseToJsonElement(body)
    } catch (e: Exception) {
        log.warn(
            "Invalid JSON in feedback submission from team=${identity.team} app=${identity.app} parseErrorType=${e::class.simpleName}"
        )
        throw ApiErrorException.BadRequestException("Invalid JSON")
    }

    val schemaVersion = extractSchemaVersion(jsonElement)

    when (schemaVersion) {
        1 -> {
            val submission = decodeSubmissionV1(jsonElement)
            SubmissionValidator.validateSubmissionV1(submission)
            respondWithSubmissionResult(
                call = call,
                identity = identity,
                submission = submission,
                submissionOutcome = submissionService.submit(
                    feedbackJson = body,
                    team = identity.team,
                    app = identity.app,
                    submission = submission
                )
            )
        }

        2 -> {
            val submission = decodeSubmissionV2(jsonElement)
            SubmissionV2Validator.validateSubmissionV2(submission)
            val v1CompatibleSubmission = FeedbackSubmissionV1(
                schemaVersion = submission.schemaVersion,
                surveyId = submission.surveyId,
                surveyType = submission.surveyType,
                submittedAt = submission.submittedAt,
                startedAt = submission.startedAt,
                timeToCompleteMs = submission.timeToCompleteMs,
                deduplicationKey = submission.deduplicationKey,
                context = submission.context,
                answers = submission.answers
            )
            respondWithSubmissionResult(
                call = call,
                identity = identity,
                submission = v1CompatibleSubmission,
                submissionOutcome = submissionService.submit(
                    feedbackJson = body,
                    team = identity.team,
                    app = identity.app,
                    submission = v1CompatibleSubmission,
                    definition = submission.definition.toSurveyDefinition(submission.surveyId),
                    allowDefinitionExpansion = false
                )
            )
        }

        else -> throw ApiErrorException.BadRequestException(
            "UNSUPPORTED_SCHEMA: schemaVersion=$schemaVersion is not supported"
        )
    }
}

private fun extractSchemaVersion(jsonElement: kotlinx.serialization.json.JsonElement): Int {
    val jsonObject = runCatching { jsonElement.jsonObject }
        .getOrElse { throw ApiErrorException.BadRequestException("Invalid payload") }

    val rawSchemaVersion = jsonObject["schemaVersion"]
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion is required")

    val schemaVersion = rawSchemaVersion as? JsonPrimitive
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion must be an integer")

    return schemaVersion.intOrNull
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion must be an integer")
}

private fun decodeSubmissionV1(jsonElement: kotlinx.serialization.json.JsonElement): FeedbackSubmissionV1 {
    return try {
        strictJson.decodeFromJsonElement(FeedbackSubmissionV1.serializer(), jsonElement)
    } catch (e: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid payload")
    }
}

@OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)
private fun decodeSubmissionV2(jsonElement: kotlinx.serialization.json.JsonElement): FeedbackSubmissionV2 {
    return try {
        strictJson.decodeFromJsonElement(FeedbackSubmissionV2.serializer(), jsonElement)
    } catch (e: MissingFieldException) {
        when {
            e.missingFields.contains("definition") -> {
                throw ApiErrorException.BadRequestException("Invalid payload: definition is required for schemaVersion=2")
            }

            e.missingFields.contains("deduplicationKey") -> {
                throw ApiErrorException.BadRequestException("Invalid payload: deduplicationKey is required for schemaVersion=2")
            }
        }
        throw ApiErrorException.BadRequestException("Invalid payload")
    } catch (e: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid payload")
    }
}

private suspend fun respondWithSubmissionResult(
    call: io.ktor.server.application.ApplicationCall,
    identity: no.nav.lumi.config.auth.CallerIdentity,
    submission: FeedbackSubmissionV1,
    submissionOutcome: no.nav.lumi.service.SubmissionOutcome
) {
    when (val saveResult = submissionOutcome.saveResult) {
        is SaveResult.Created -> {
            log.info(
                "Saved feedback id=${saveResult.id} team=${identity.team} app=${identity.app} surveyId=${submission.surveyId} definitionHash=${submissionOutcome.definitionHash}"
            )
            call.respond(HttpStatusCode.Created, mapOf("id" to saveResult.id))
        }

        is SaveResult.Duplicate -> {
            log.info(
                "Deduplicated feedback id=${saveResult.id} team=${identity.team} app=${identity.app} surveyId=${submission.surveyId}"
            )
            call.respond(
                HttpStatusCode.OK,
                buildJsonObject {
                    put("id", saveResult.id)
                    put("duplicate", true)
                }
            )
        }
    }
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
