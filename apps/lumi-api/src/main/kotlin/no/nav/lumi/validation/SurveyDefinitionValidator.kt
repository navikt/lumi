package no.nav.lumi.validation

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.RatingVariant
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.repository.isSafeChoiceValue

object SurveyDefinitionValidator {
    fun validateDefinition(definition: SurveyDefinition) {
        if (definition.fields.size > MAX_FIELDS_PER_DEFINITION) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: definition.fields max count is $MAX_FIELDS_PER_DEFINITION"
            )
        }

        val duplicateIds = definition.fields.groupBy { it.fieldId }.filter { it.value.size > 1 }.keys
        if (duplicateIds.isNotEmpty()) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: duplicate fieldIds=$duplicateIds"
            )
        }

        definition.fields.forEach { field ->
            validateFieldId(field.fieldId)

            when (field.fieldType) {
                FieldType.RATING -> {
                    val variant = field.ratingVariant
                        ?: throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (RATING) requires ratingVariant and ratingScale"
                        )
                    val scale = field.ratingScale
                        ?: throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (RATING) requires ratingVariant and ratingScale"
                        )

                    val expectedScale = RatingVariant.getScale(variant)
                    if (scale != expectedScale) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} ratingScale=$scale does not match ratingVariant=$variant (expected $expectedScale)"
                        )
                    }
                    if (field.optionIds != null) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (RATING) must not include optionIds"
                        )
                    }
                }

                FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE -> {
                    if (field.optionIds.isNullOrEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (${field.fieldType}) requires at least one option"
                        )
                    }
                    field.optionIds.forEach { validateOptionId(it, field.fieldId) }
                    val duplicates = field.optionIds.groupBy { it }.filter { it.value.size > 1 }.keys
                    if (duplicates.isNotEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} has duplicate optionIds=$duplicates"
                        )
                    }
                    if (field.ratingVariant != null || field.ratingScale != null) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (${field.fieldType}) must not include ratingVariant or ratingScale"
                        )
                    }
                }

                else -> {
                    if (field.ratingVariant != null || field.ratingScale != null) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (${field.fieldType}) must not include ratingVariant or ratingScale"
                        )
                    }
                    if (field.optionIds != null) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (${field.fieldType}) must not include optionIds"
                        )
                    }
                }
            }
        }
    }

    fun validateAnswersAgainstDefinition(
        definition: SurveyDefinition,
        answers: List<Answer>,
        surveyId: String = definition.surveyId
    ) {
        val fieldsById = definition.fields.associateBy { it.fieldId }

        answers.forEach { answer ->
            val field = fieldsById[answer.fieldId]
                ?: throw ApiErrorException.BadRequestException(
                    "Invalid payload: unknown fieldId=${answer.fieldId} for surveyId=$surveyId"
                )

            if (field.fieldType != answer.fieldType) {
                throw ApiErrorException.BadRequestException(
                    "Invalid payload: fieldId=${answer.fieldId} has fieldType=${answer.fieldType}, expected ${field.fieldType}"
                )
            }

            val expectedFieldType = expectedFieldType(answer.value)
            if (field.fieldType != expectedFieldType) {
                throw ApiErrorException.BadRequestException(
                    "Invalid payload: fieldId=${answer.fieldId} has fieldType=${field.fieldType}, expected $expectedFieldType"
                )
            }

            when (val value = answer.value) {
                is AnswerValue.Rating -> {
                    if (field.ratingVariant != value.ratingVariant || field.ratingScale != value.ratingScale) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: rating config for fieldId=${answer.fieldId} does not match stored definition"
                        )
                    }
                }

                is AnswerValue.SingleChoice -> {
                    validateChoiceQuestionOptions(answer, field.optionIds.orEmpty())
                    val optionIds = field.optionIds.orEmpty()
                    if (value.selectedOptionId !in optionIds) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: selectedOptionId=${value.selectedOptionId} is not valid for fieldId=${answer.fieldId}"
                        )
                    }
                }

                is AnswerValue.MultiChoice -> {
                    validateChoiceQuestionOptions(answer, field.optionIds.orEmpty())
                    val duplicateSelections = value.selectedOptionIds.groupBy { it }.filter { it.value.size > 1 }.keys
                    if (duplicateSelections.isNotEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: duplicate selectedOptionIds=$duplicateSelections for fieldId=${answer.fieldId}"
                        )
                    }
                    val optionIds = field.optionIds.orEmpty().toSet()
                    val invalidIds = value.selectedOptionIds.filterNot(optionIds::contains)
                    if (invalidIds.isNotEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: selectedOptionIds=$invalidIds are not valid for fieldId=${answer.fieldId}"
                        )
                    }
                }

                is AnswerValue.Text, is AnswerValue.DateValue -> Unit
            }
        }
    }

    private fun validateChoiceQuestionOptions(
        answer: Answer,
        definitionOptionIds: List<String>
    ) {
        val answerOptionIds = answer.question.options?.map { it.id }
            ?: throw ApiErrorException.BadRequestException(
                "Invalid payload: choice answer fieldId=${answer.fieldId} must include question.options to match definition.optionIds"
            )

        if (answerOptionIds != definitionOptionIds) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: choice answer fieldId=${answer.fieldId} question.options must match definition.optionIds"
            )
        }
    }

    private fun expectedFieldType(value: AnswerValue): FieldType {
        return when (value) {
            is AnswerValue.Rating -> FieldType.RATING
            is AnswerValue.Text -> FieldType.TEXT
            is AnswerValue.SingleChoice -> FieldType.SINGLE_CHOICE
            is AnswerValue.MultiChoice -> FieldType.MULTI_CHOICE
            is AnswerValue.DateValue -> FieldType.DATE
        }
    }

    /** fieldId: alphanumeric + hyphen + underscore, max 200 chars */
    private fun validateFieldId(fieldId: String) {
        if (fieldId.isBlank()) {
            throw ApiErrorException.BadRequestException("Invalid payload: fieldId must be non-blank")
        }
        if (fieldId.length > MAX_IDENTIFIER_LENGTH) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId exceeds max length $MAX_IDENTIFIER_LENGTH"
            )
        }
        if (!fieldId.all { it.isLetterOrDigit() || it == '-' || it == '_' }) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId=$fieldId contains illegal characters (allowed: alphanumeric, hyphen, underscore)"
            )
        }
    }

    private fun validateOptionId(optionId: String, fieldId: String) {
        if (optionId.isBlank()) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId=$fieldId has blank optionIds"
            )
        }
        if (optionId.length > MAX_IDENTIFIER_LENGTH) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId=$fieldId has optionId exceeding max length $MAX_IDENTIFIER_LENGTH"
            )
        }
        if (!isSafeChoiceValue(optionId)) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId=$fieldId has optionId containing illegal characters"
            )
        }
    }

    private const val MAX_FIELDS_PER_DEFINITION = 50
    private const val MAX_IDENTIFIER_LENGTH = 200
}
