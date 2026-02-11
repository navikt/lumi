package no.nav.lumi.validation

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.RatingVariant
import java.time.Instant

object SubmissionValidator {
    private const val MAX_SURVEY_ID_LENGTH = 200
    private const val MAX_ANSWERS_PER_SUBMISSION = 50
    private const val MAX_TEXT_ANSWER_LENGTH = 2_000
    private const val MAX_CONTEXT_TAGS = 20
    private const val MAX_CONTEXT_TAG_KEY_LENGTH = 50
    private const val MAX_CONTEXT_TAG_VALUE_LENGTH = 100
    private const val MAX_CONTEXT_DEBUG_BYTES = 8_192
    private const val MAX_CONTEXT_DEBUG_DEPTH = 4
    private const val MAX_CONTEXT_DEBUG_KEYS = 50

    fun validateSubmissionV1(submission: FeedbackSubmissionV1) {
        if (submission.schemaVersion != 1) {
            throw ApiErrorException.BadRequestException(
                "UNSUPPORTED_SCHEMA: schemaVersion=${submission.schemaVersion} is not supported"
            )
        }

        if (submission.surveyId.isBlank()) {
            throw ApiErrorException.BadRequestException("Invalid payload: surveyId must be non-blank")
        }
        if (submission.surveyId.length > MAX_SURVEY_ID_LENGTH) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: surveyId max length is $MAX_SURVEY_ID_LENGTH"
            )
        }

        runCatching { Instant.parse(submission.submittedAt) }
            .getOrElse { throw ApiErrorException.BadRequestException("Invalid payload: submittedAt must be an ISO instant") }

        if (submission.startedAt != null) {
            runCatching { Instant.parse(submission.startedAt) }
                .getOrElse { throw ApiErrorException.BadRequestException("Invalid payload: startedAt must be an ISO instant") }
        }

        if (submission.answers.isEmpty()) {
            throw ApiErrorException.BadRequestException("Invalid payload: answers must be non-empty")
        }
        if (submission.answers.size > MAX_ANSWERS_PER_SUBMISSION) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: answers max count is $MAX_ANSWERS_PER_SUBMISSION"
            )
        }

        val uniqueFieldIds = submission.answers.map { it.fieldId }.toSet().size
        if (uniqueFieldIds != submission.answers.size) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: answers.fieldId must be unique"
            )
        }

        submission.context?.let { context ->
            val tags = context.tags
            if (tags != null) {
                if (tags.size > MAX_CONTEXT_TAGS) {
                    throw ApiErrorException.BadRequestException(
                        "Invalid payload: context.tags max count is $MAX_CONTEXT_TAGS"
                    )
                }
                for ((key, value) in tags) {
                    if (key.isBlank()) {
                        throw ApiErrorException.BadRequestException("Invalid payload: context.tags keys must be non-blank")
                    }
                    if (key.length > MAX_CONTEXT_TAG_KEY_LENGTH) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: context.tags key max length is $MAX_CONTEXT_TAG_KEY_LENGTH"
                        )
                    }
                    if (value.content.length > MAX_CONTEXT_TAG_VALUE_LENGTH) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: context.tags value max length is $MAX_CONTEXT_TAG_VALUE_LENGTH"
                        )
                    }
                }
            }

            context.debug?.let { debug ->
                val debugBytes = debug.toString().toByteArray().size
                if (debugBytes > MAX_CONTEXT_DEBUG_BYTES) {
                    throw ApiErrorException.BadRequestException(
                        "Invalid payload: context.debug max size is $MAX_CONTEXT_DEBUG_BYTES bytes"
                    )
                }

                val debugDepth = maxJsonDepth(debug)
                if (debugDepth > MAX_CONTEXT_DEBUG_DEPTH) {
                    throw ApiErrorException.BadRequestException(
                        "Invalid payload: context.debug max depth is $MAX_CONTEXT_DEBUG_DEPTH"
                    )
                }

                val debugKeyCount = totalJsonKeys(debug)
                if (debugKeyCount > MAX_CONTEXT_DEBUG_KEYS) {
                    throw ApiErrorException.BadRequestException(
                        "Invalid payload: context.debug max key count is $MAX_CONTEXT_DEBUG_KEYS"
                    )
                }
            }
        }

        submission.answers.forEach { answer ->
            if (answer.fieldId.isBlank()) {
                throw ApiErrorException.BadRequestException("Invalid payload: answers.fieldId must be non-blank")
            }

            when (val value = answer.value) {
                is AnswerValue.Rating -> {
                    val variant = value.ratingVariant
                        ?: throw ApiErrorException.BadRequestException("Invalid payload: ratingVariant is required for rating answers")
                    val scale = value.ratingScale
                        ?: throw ApiErrorException.BadRequestException("Invalid payload: ratingScale is required for rating answers")

                    val expectedScale = RatingVariant.getScale(variant)
                    if (scale != expectedScale) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: ratingScale=$scale does not match ratingVariant=$variant (expected $expectedScale)"
                        )
                    }

                    val (minRating, maxRating) = if (variant == RatingVariant.NPS) {
                        0 to 10
                    } else {
                        1 to scale
                    }

                    if (value.rating !in minRating..maxRating) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: rating=${value.rating} out of range for ratingVariant=$variant ($minRating-$maxRating)"
                        )
                    }
                }

                is AnswerValue.Text -> {
                    if (value.text.length > MAX_TEXT_ANSWER_LENGTH) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: text answer max length is $MAX_TEXT_ANSWER_LENGTH"
                        )
                    }
                }

                is AnswerValue.SingleChoice -> {
                    if (value.selectedOptionId.isBlank()) {
                        throw ApiErrorException.BadRequestException("Invalid payload: selectedOptionId must be non-blank")
                    }
                }

                is AnswerValue.MultiChoice -> {
                    if (value.selectedOptionIds.isEmpty()) {
                        throw ApiErrorException.BadRequestException("Invalid payload: selectedOptionIds must be non-empty")
                    }
                }

                is AnswerValue.DateValue -> {
                    if (value.date.isBlank()) {
                        throw ApiErrorException.BadRequestException("Invalid payload: date must be non-blank")
                    }
                }
            }
        }
    }

    private fun maxJsonDepth(jsonObject: JsonObject): Int {
        fun depth(element: JsonElement, currentDepth: Int): Int {
            return when (element) {
                is JsonObject -> {
                    if (element.isEmpty()) {
                        currentDepth
                    } else {
                        element.values.maxOf { value -> depth(value, currentDepth + 1) }
                    }
                }
                is kotlinx.serialization.json.JsonArray -> {
                    if (element.isEmpty()) {
                        currentDepth
                    } else {
                        element.maxOf { value -> depth(value, currentDepth + 1) }
                    }
                }
                else -> currentDepth
            }
        }

        return depth(jsonObject, currentDepth = 0)
    }

    private fun totalJsonKeys(jsonObject: JsonObject): Int {
        fun count(element: JsonElement): Int {
            return when (element) {
                is JsonObject -> element.size + element.values.sumOf(::count)
                is kotlinx.serialization.json.JsonArray -> element.sumOf(::count)
                else -> 0
            }
        }

        return count(jsonObject)
    }
}
