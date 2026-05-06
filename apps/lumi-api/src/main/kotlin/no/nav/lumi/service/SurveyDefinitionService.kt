package no.nav.lumi.service

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.DefinitionDiff
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.computeHash
import no.nav.lumi.domain.diff
import no.nav.lumi.domain.mergeWith
import no.nav.lumi.repository.StoredSurveyDefinition
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.repository.isSafeChoiceValue

data class RegistrationResult(
    val surveyId: String,
    val definitionHash: String
)

class SurveyDefinitionService(
    private val repository: SurveyDefinitionRepository = SurveyDefinitionRepository()
) {
    suspend fun registerOrValidate(team: String, submission: FeedbackSubmissionV1): RegistrationResult {
        val incomingDefinition = SurveyDefinition.fromSubmission(submission)
        validateDefinitionConsistency(incomingDefinition)
        validateAnswersAgainstIncomingDefinition(incomingDefinition, submission)
        val incomingHash = incomingDefinition.computeHash()

        repeat(MAX_REGISTRATION_ATTEMPTS) {
            val stored = repository.findByTeamAndSurveyId(team, submission.surveyId)
            if (stored != null) {
                when (val result = handleExistingDefinition(team, stored, incomingDefinition)) {
                    is ExistingDefinitionResult.Resolved -> return result.registrationResult
                    ExistingDefinitionResult.Retry -> return@repeat
                }
            }

            val insertedCount = repository.insertIfUnderLimit(
                team = team,
                definition = incomingDefinition,
                definitionHash = incomingHash,
                maxDefinitions = MAX_DEFINITIONS_PER_TEAM
            )

            if (insertedCount == 1) {
                return RegistrationResult(submission.surveyId, incomingHash)
            }

            val existingAfterRace = repository.findByTeamAndSurveyId(team, submission.surveyId)
            if (existingAfterRace == null) {
                throw ApiErrorException.TooManyRequestsException(
                    "Definition limit exceeded for team=$team (max=$MAX_DEFINITIONS_PER_TEAM)"
                )
            }

            when (val result = handleExistingDefinition(team, existingAfterRace, incomingDefinition)) {
                is ExistingDefinitionResult.Resolved -> return result.registrationResult
                ExistingDefinitionResult.Retry -> return@repeat
            }
        }

        throw ApiErrorException.InternalServerErrorException(
            "Failed to register survey definition for surveyId=${submission.surveyId} after retrying concurrent updates"
        )
    }

    /**
     * Validate the first submission's answers against its own derived definition.
     * Prevents a malformed first payload from persisting invalid feedback data
     * (e.g., SINGLE_CHOICE answer with selectedOptionId not in options).
     */
    private fun validateAnswersAgainstIncomingDefinition(
        definition: SurveyDefinition,
        submission: FeedbackSubmissionV1
    ) {
        val synthetic = StoredSurveyDefinition(
            team = "",
            surveyId = definition.surveyId,
            definitionHash = "",
            definition = definition
        )
        validateAnswersAgainstStoredDefinition(synthetic, submission)
    }

    private suspend fun handleExistingDefinition(
        team: String,
        stored: StoredSurveyDefinition,
        incomingDefinition: SurveyDefinition
    ): ExistingDefinitionResult {
        val mergedDefinition = stored.definition.mergeWith(incomingDefinition)
        val definitionDiff = diff(stored.definition, mergedDefinition)
        if (definitionDiff.changedFields.isNotEmpty()) {
            throwDefinitionConflict(stored.surveyId, definitionDiff)
        }

        if (definitionDiff.addedFields.isEmpty()) {
            return ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, stored.definitionHash)
            )
        }

        val mergedHash = mergedDefinition.computeHash()
        if (mergedHash == stored.definitionHash) {
            return ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, stored.definitionHash)
            )
        }

        val updated = repository.updateDefinitionIfHashMatches(
            team = team,
            surveyId = stored.surveyId,
            expectedDefinitionHash = stored.definitionHash,
            definition = mergedDefinition,
            newDefinitionHash = mergedHash
        )

        return if (updated) {
            ExistingDefinitionResult.Resolved(
                RegistrationResult(stored.surveyId, mergedHash)
            )
        } else {
            ExistingDefinitionResult.Retry
        }
    }

    private fun validateAnswersAgainstStoredDefinition(
        stored: StoredSurveyDefinition,
        submission: FeedbackSubmissionV1
    ) {
        val storedFieldsById = stored.definition.fields.associateBy { it.fieldId }

        submission.answers.forEach { answer ->
            val storedField = storedFieldsById[answer.fieldId]
                ?: throw ApiErrorException.BadRequestException(
                    "Invalid payload: unknown fieldId=${answer.fieldId} for surveyId=${stored.surveyId}"
                )

            if (storedField.fieldType != answer.fieldType) {
                throw ApiErrorException.BadRequestException(
                    "Invalid payload: fieldId=${answer.fieldId} has fieldType=${answer.fieldType}, expected ${storedField.fieldType}"
                )
            }

            val expectedFieldType = expectedFieldType(answer.value)
            if (storedField.fieldType != expectedFieldType) {
                throw ApiErrorException.BadRequestException(
                    "Invalid payload: fieldId=${answer.fieldId} has fieldType=${storedField.fieldType}, expected $expectedFieldType"
                )
            }

            when (val value = answer.value) {
                is AnswerValue.Rating -> {
                    if (storedField.ratingVariant != value.ratingVariant || storedField.ratingScale != value.ratingScale) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: rating config for fieldId=${answer.fieldId} does not match stored definition"
                        )
                    }
                }

                is AnswerValue.SingleChoice -> {
                    val optionIds = storedField.optionIds.orEmpty()
                    if (value.selectedOptionId !in optionIds) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: selectedOptionId=${value.selectedOptionId} is not valid for fieldId=${answer.fieldId}"
                        )
                    }
                }

                is AnswerValue.MultiChoice -> {
                    val duplicateSelections = value.selectedOptionIds.groupBy { it }.filter { it.value.size > 1 }.keys
                    if (duplicateSelections.isNotEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: duplicate selectedOptionIds=$duplicateSelections for fieldId=${answer.fieldId}"
                        )
                    }
                    val optionIds = storedField.optionIds.orEmpty().toSet()
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

    private fun expectedFieldType(value: AnswerValue): FieldType {
        return when (value) {
            is AnswerValue.Rating -> FieldType.RATING
            is AnswerValue.Text -> FieldType.TEXT
            is AnswerValue.SingleChoice -> FieldType.SINGLE_CHOICE
            is AnswerValue.MultiChoice -> FieldType.MULTI_CHOICE
            is AnswerValue.DateValue -> FieldType.DATE
        }
    }

    /**
     * Validate structural consistency of a definition before first registration.
     * Prevents a malformed first submission from permanently locking an invalid structure.
     */
    private fun validateDefinitionConsistency(definition: SurveyDefinition) {
        val duplicateIds = definition.fields.groupBy { it.fieldId }.filter { it.value.size > 1 }.keys
        if (duplicateIds.isNotEmpty()) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: duplicate fieldIds=$duplicateIds"
            )
        }

        definition.fields.forEach { field ->
            validateFieldId(field.fieldId)

            when (field.fieldType) {
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
                }

                FieldType.RATING -> {
                    if (field.ratingVariant == null || field.ratingScale == null) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (RATING) requires ratingVariant and ratingScale"
                        )
                    }
                }

                else -> { /* TEXT, DATE — no structural requirements */ }
            }
        }
    }

    private fun throwDefinitionConflict(surveyId: String, definitionDiff: DefinitionDiff): Nothing {
        throw ApiErrorException.ConflictException(
            "Survey definition conflict for surveyId=$surveyId: ${definitionDiff.describe()}"
        )
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

    private sealed interface ExistingDefinitionResult {
        data class Resolved(val registrationResult: RegistrationResult) : ExistingDefinitionResult
        data object Retry : ExistingDefinitionResult
    }

    private companion object {
        const val MAX_DEFINITIONS_PER_TEAM = 500
        const val MAX_IDENTIFIER_LENGTH = 200
        const val MAX_REGISTRATION_ATTEMPTS = 5
    }
}
