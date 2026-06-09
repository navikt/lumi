package no.nav.lumi.routes

import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveChannel
import io.ktor.utils.io.core.readText
import io.ktor.utils.io.readRemaining
import kotlinx.serialization.MissingFieldException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FeedbackSubmissionV2
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.validation.SubmissionV2Validator
import no.nav.lumi.validation.SubmissionValidator

internal const val MAX_SUBMISSION_BYTES = 1_048_576L

internal val strictSubmissionJson = Json {
    ignoreUnknownKeys = false
    isLenient = false
    encodeDefaults = true
}

internal data class ParsedSubmission(
    val submission: FeedbackSubmissionV1,
    val definition: SurveyDefinition? = null
)

internal fun decodeValidatedSubmission(jsonElement: JsonElement): ParsedSubmission {
    val schemaVersion = extractSchemaVersion(jsonElement)

    return when (schemaVersion) {
        1 -> {
            val submission = decodeSubmissionV1(jsonElement)
            SubmissionValidator.validateSubmissionV1(submission)
            ParsedSubmission(submission = submission)
        }

        2 -> {
            val submission = decodeSubmissionV2(jsonElement)
            SubmissionV2Validator.validateSubmissionV2(submission)
            ParsedSubmission(
                submission = submission.toV1CompatibleSubmission(),
                definition = submission.definition.toSurveyDefinition(submission.surveyId)
            )
        }

        else -> throw ApiErrorException.BadRequestException(
            "UNSUPPORTED_SCHEMA: schemaVersion=$schemaVersion is not supported"
        )
    }
}

internal suspend fun receiveTextWithLimit(call: ApplicationCall): String {
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

private fun extractSchemaVersion(jsonElement: JsonElement): Int {
    val jsonObject = runCatching { jsonElement.jsonObject }
        .getOrElse { throw ApiErrorException.BadRequestException("Invalid payload") }

    val rawSchemaVersion = jsonObject["schemaVersion"]
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion is required")

    val schemaVersion = rawSchemaVersion as? JsonPrimitive
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion must be an integer")

    return schemaVersion.intOrNull
        ?: throw ApiErrorException.BadRequestException("Invalid payload: schemaVersion must be an integer")
}

private fun decodeSubmissionV1(jsonElement: JsonElement): FeedbackSubmissionV1 {
    return try {
        strictSubmissionJson.decodeFromJsonElement(FeedbackSubmissionV1.serializer(), jsonElement)
    } catch (_: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid payload")
    }
}

@OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)
private fun decodeSubmissionV2(jsonElement: JsonElement): FeedbackSubmissionV2 {
    return try {
        strictSubmissionJson.decodeFromJsonElement(FeedbackSubmissionV2.serializer(), jsonElement)
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
    } catch (_: SerializationException) {
        throw ApiErrorException.BadRequestException("Invalid payload")
    }
}

private fun FeedbackSubmissionV2.toV1CompatibleSubmission(): FeedbackSubmissionV1 {
    return FeedbackSubmissionV1(
        schemaVersion = schemaVersion,
        surveyId = surveyId,
        surveyType = surveyType,
        submittedAt = submittedAt,
        startedAt = startedAt,
        timeToCompleteMs = timeToCompleteMs,
        deduplicationKey = deduplicationKey,
        context = context,
        answers = answers
    )
}
