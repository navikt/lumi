package no.nav.lumi.routes

import io.ktor.http.*
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import no.nav.lumi.config.SubmissionChannel
import no.nav.lumi.config.SubmissionMetricOutcome
import no.nav.lumi.config.SubmissionObservability
import no.nav.lumi.config.SubmissionRateLimit
import no.nav.lumi.config.UserSubmissionRateLimit
import no.nav.lumi.config.auth.AzureSubmissionAuthPlugin
import no.nav.lumi.config.auth.TokenXSubmissionAuthPlugin
import no.nav.lumi.config.auth.getCallerIdentity
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.service.SurveyDefinitionService
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("SubmissionRoutes")
private val defaultFeedbackService = FeedbackService()
private val defaultSurveyDefinitionService = SurveyDefinitionService()
private val defaultSubmissionObservability = SubmissionObservability()

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
    submissionService: SubmissionService = SubmissionService(feedbackService, surveyDefinitionService),
    submissionObservability: SubmissionObservability = defaultSubmissionObservability
) {
    route("/api/tokenx") {
        install(TokenXSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") {
                    submissionObservability.observeAttempt(SubmissionChannel.TOKENX) {
                        handleSubmission(
                            call,
                            submissionService,
                            submissionObservability,
                            SubmissionChannel.TOKENX
                        )
                    }
                }
            }
        }
    }

    route("/api/azure") {
        install(AzureSubmissionAuthPlugin)
        rateLimit(SubmissionRateLimit) {
            rateLimit(UserSubmissionRateLimit) {
                post("/v1/feedback") {
                    submissionObservability.observeAttempt(SubmissionChannel.AZURE) {
                        handleSubmission(
                            call,
                            submissionService,
                            submissionObservability,
                            SubmissionChannel.AZURE
                        )
                    }
                }
            }
        }
    }
}

private suspend fun handleSubmission(
    call: io.ktor.server.application.ApplicationCall,
    submissionService: SubmissionService,
    submissionObservability: SubmissionObservability,
    submissionChannel: SubmissionChannel
) {
    val identity = call.getCallerIdentity()
    val body = receiveTextWithLimit(call)

    val jsonElement = try {
        strictSubmissionJson.parseToJsonElement(body)
    } catch (e: Exception) {
        log.warn(
            "Invalid JSON in feedback submission from team=${identity.team} app=${identity.app} parseErrorType=${e::class.simpleName}"
        )
        throw ApiErrorException.BadRequestException("Invalid JSON")
    }

    val parsedSubmission = decodeValidatedSubmission(jsonElement)

    val outcome = respondWithSubmissionResult(
        call = call,
        identity = identity,
        submission = parsedSubmission.submission,
        submissionOutcome = submissionService.submit(
            feedbackJson = body,
            team = identity.team,
            app = identity.app,
            submission = parsedSubmission.submission,
            definition = parsedSubmission.definition
        )
    )
    submissionObservability.record(submissionChannel, outcome)
}

private suspend fun respondWithSubmissionResult(
    call: io.ktor.server.application.ApplicationCall,
    identity: no.nav.lumi.config.auth.CallerIdentity,
    submission: FeedbackSubmissionV1,
    submissionOutcome: no.nav.lumi.service.SubmissionOutcome
): SubmissionMetricOutcome {
    when (val saveResult = submissionOutcome.saveResult) {
        is SaveResult.Created -> {
            log.info(
                "Saved feedback id=${saveResult.id} team=${identity.team} app=${identity.app} surveyId=${submission.surveyId} definitionHash=${submissionOutcome.definitionHash}"
            )
            call.respond(HttpStatusCode.Created, mapOf("id" to saveResult.id))
            return SubmissionMetricOutcome.CREATED
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
            return SubmissionMetricOutcome.DUPLICATE
        }
    }
}
