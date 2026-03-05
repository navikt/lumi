package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import no.nav.lumi.config.auth.CallerIdentityKey
import no.nav.lumi.config.auth.parseCallerIdentity
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.validation.SubmissionValidator
import org.slf4j.LoggerFactory
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.SerializationException
import no.nav.lumi.domain.FeedbackSubmissionV1
import java.security.MessageDigest

private val log = LoggerFactory.getLogger("InternalSubmissionRoutes")

private const val SUBMISSION_KEY_HEADER = "X-Lumi-Submission-Key"
private const val CALLER_IDENTITY_HEADER = "X-Lumi-Caller-Identity"
private const val MAX_SUBMISSION_BYTES = 1_048_576L

private val strictJson = Json {
    ignoreUnknownKeys = false
    isLenient = false
    encodeDefaults = true
}

/**
 * Internal submission route for cross-tenant proxy forwarding in dev.
 *
 * Only registered when LUMI_INTERNAL_SUBMISSION_KEY is set (dev environment).
 * Secured by NAIS network policy (only lumi-submission-proxy can reach this)
 * plus a pre-shared key for defense in depth.
 */
fun Route.internalSubmissionRoutes(
    feedbackService: FeedbackService = FeedbackService(),
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
                strictJson.parseToJsonElement(body)
            } catch (e: Exception) {
                log.warn("Internal submission: invalid JSON from ${identity.team}/${identity.app}", e)
                throw ApiErrorException.BadRequestException("Invalid JSON")
            }

            val submission = try {
                strictJson.decodeFromJsonElement(FeedbackSubmissionV1.serializer(), jsonElement)
            } catch (e: SerializationException) {
                throw ApiErrorException.BadRequestException("Invalid payload")
            }

            SubmissionValidator.validateSubmissionV1(submission)

            val id = feedbackService.save(
                feedbackJson = body,
                team = identity.team,
                app = identity.app
            )

            log.info("Internal submission: saved feedback id=$id team=${identity.team} app=${identity.app} surveyId=${submission.surveyId}")
            call.respond(HttpStatusCode.Created, mapOf("id" to id))
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
