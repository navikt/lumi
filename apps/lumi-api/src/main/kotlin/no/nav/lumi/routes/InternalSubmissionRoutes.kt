package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.parseCallerIdentity
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.service.SurveyDefinitionService
import org.slf4j.LoggerFactory
import no.nav.lumi.domain.SaveResult
import java.security.MessageDigest

private val log = LoggerFactory.getLogger("InternalSubmissionRoutes")

private const val SUBMISSION_KEY_HEADER = "X-Lumi-Submission-Key"
private const val CALLER_IDENTITY_HEADER = "X-Lumi-Caller-Identity"

/**
 * Internal submission route for cross-tenant proxy forwarding in dev.
 *
 * Only registered when LUMI_INTERNAL_SUBMISSION_KEY is set (dev environment).
 * Secured by NAIS network policy (only lumi-submission-proxy can reach this)
 * plus a pre-shared key for defense in depth.
 */
fun Route.internalSubmissionRoutes(
    feedbackService: FeedbackService = FeedbackService(),
    surveyDefinitionService: SurveyDefinitionService = SurveyDefinitionService(),
    submissionService: SubmissionService = SubmissionService(feedbackService, surveyDefinitionService),
    submissionKey: String? = System.getenv("LUMI_INTERNAL_SUBMISSION_KEY")
) {
    if (submissionKey.isNullOrBlank()) {
        log.info("LUMI_INTERNAL_SUBMISSION_KEY not set, internal submission routes disabled")
        return
    }

    val expectedKey = submissionKey

    log.info("Internal submission routes enabled (proxy forwarding)")

    route("/api/internal/v1") {
        post("/feedback") {
            val providedKey = call.request.header(SUBMISSION_KEY_HEADER)
            if (providedKey == null || !MessageDigest.isEqual(providedKey.toByteArray(), expectedKey.toByteArray())) {
                log.warn("Internal submission: invalid or missing $SUBMISSION_KEY_HEADER")
                throw ApiErrorException.UnauthorizedException("Invalid submission key")
            }

            val callerIdRaw = call.request.header(CALLER_IDENTITY_HEADER)
            if (callerIdRaw.isNullOrBlank()) {
                log.warn("Internal submission: missing $CALLER_IDENTITY_HEADER header")
                throw ApiErrorException.BadRequestException("Missing $CALLER_IDENTITY_HEADER header")
            }

            val identity = parseCallerIdentity(callerIdRaw)
                ?: throw ApiErrorException.BadRequestException("Invalid caller identity format: expected cluster:namespace:app")

            call.attributes.put(CallerIdentityKey, identity)

            val body = receiveTextWithLimit(call)

            val jsonElement = try {
                strictSubmissionJson.parseToJsonElement(body)
            } catch (e: Exception) {
                log.warn(
                    "Internal submission: invalid JSON from ${identity.team}/${identity.app} parseErrorType=${e::class.simpleName}"
                )
                throw ApiErrorException.BadRequestException("Invalid JSON")
            }

            val parsedSubmission = decodeValidatedSubmission(jsonElement)
            val submission = parsedSubmission.submission
            val submissionOutcome = submissionService.submit(
                feedbackJson = body,
                team = identity.team,
                app = identity.app,
                submission = submission,
                definition = parsedSubmission.definition
            )

            when (val saveResult = submissionOutcome.saveResult) {
                is SaveResult.Created -> {
                    log.info(
                        "Internal submission: saved feedback id=${saveResult.id} team=${identity.team} app=${identity.app} surveyId=${submission.surveyId} definitionHash=${submissionOutcome.definitionHash}"
                    )
                    call.respond(HttpStatusCode.Created, mapOf("id" to saveResult.id))
                }
                is SaveResult.Duplicate -> {
                    log.info(
                        "Internal submission: deduplicated feedback id=${saveResult.id} team=${identity.team} app=${identity.app} surveyId=${submission.surveyId}"
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
    }
}
