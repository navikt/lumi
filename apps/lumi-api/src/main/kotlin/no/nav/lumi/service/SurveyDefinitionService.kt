package no.nav.lumi.service

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.DefinitionDiff
import no.nav.lumi.domain.FeedbackSubmissionV1
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.computeHash
import no.nav.lumi.domain.diff
import no.nav.lumi.repository.StoredSurveyDefinition
import no.nav.lumi.repository.SurveyDefinitionRepository

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
        validateAnswersAgainstDefinition(incomingDefinition, submission)
        val incomingHash = incomingDefinition.computeHash()

        val stored = repository.findByTeamAndSurveyId(team, submission.surveyId)
        if (stored != null) {
            validateAnswersAgainstStoredDefinition(stored, submission)
            if (stored.definitionHash == incomingHash) {
                return RegistrationResult(submission.surveyId, stored.definitionHash)
            }

            throwDefinitionConflict(submission.surveyId, diff(stored.definition, incomingDefinition))
        }

        // Single SQL: INSERT ... SELECT ... WHERE count < max ON CONFLICT DO NOTHING
        // Returns 1 if inserted, 0 if duplicate (race) or limit exceeded.
        val insertedCount = repository.insertIfUnderLimit(
            team = team,
            definition = incomingDefinition,
            definitionHash = incomingHash,
            maxDefinitions = MAX_DEFINITIONS_PER_TEAM
        )

        if (insertedCount == 1) {
            return RegistrationResult(submission.surveyId, incomingHash)
        }

        // insertedCount == 0: either UNIQUE conflict (race) or limit exceeded.
        // Re-read to distinguish: if found → concurrent insert won; if not → limit.
        val existingAfterRace = repository.findByTeamAndSurveyId(team, submission.surveyId)

        if (existingAfterRace == null) {
            // 429 used for quota exhaustion. Semantically closer to 403/422, but 429
            // is conventional in this codebase and the 500-limit is generous enough
            // that this path is rarely hit. Clients should not auto-retry.
            throw ApiErrorException.TooManyRequestsException(
                "Definition limit exceeded for team=$team (max=$MAX_DEFINITIONS_PER_TEAM)"
            )
        }

        validateAnswersAgainstStoredDefinition(existingAfterRace, submission)
        if (existingAfterRace.definitionHash == incomingHash) {
            return RegistrationResult(submission.surveyId, existingAfterRace.definitionHash)
        }

        throwDefinitionConflict(submission.surveyId, diff(existingAfterRace.definition, incomingDefinition))
    }

    /**
     * Validate the first submission's answers against its own derived definition.
     * Prevents a malformed first payload from persisting invalid feedback data
     * (e.g., SINGLE_CHOICE answer with selectedOptionId not in options).
     */
    private fun validateAnswersAgainstDefinition(
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

            when (val value = answer.value) {
                is AnswerValue.Rating -> {
                    requireFieldType(answer.fieldId, storedField.fieldType, FieldType.RATING)
                    if (storedField.ratingVariant != value.ratingVariant || storedField.ratingScale != value.ratingScale) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: rating config for fieldId=${answer.fieldId} does not match stored definition"
                        )
                    }
                }

                is AnswerValue.Text -> {
                    requireFieldType(answer.fieldId, storedField.fieldType, FieldType.TEXT)
                }

                is AnswerValue.SingleChoice -> {
                    requireFieldType(answer.fieldId, storedField.fieldType, FieldType.SINGLE_CHOICE)
                    val optionIds = storedField.optionIds.orEmpty()
                    if (value.selectedOptionId !in optionIds) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: selectedOptionId=${value.selectedOptionId} is not valid for fieldId=${answer.fieldId}"
                        )
                    }
                }

                is AnswerValue.MultiChoice -> {
                    requireFieldType(answer.fieldId, storedField.fieldType, FieldType.MULTI_CHOICE)
                    val optionIds = storedField.optionIds.orEmpty().toSet()
                    val invalidIds = value.selectedOptionIds.filterNot(optionIds::contains)
                    if (invalidIds.isNotEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: selectedOptionIds=$invalidIds are not valid for fieldId=${answer.fieldId}"
                        )
                    }
                }

                is AnswerValue.DateValue -> {
                    requireFieldType(answer.fieldId, storedField.fieldType, FieldType.DATE)
                }
            }
        }
    }

    private fun requireFieldType(fieldId: String, actual: FieldType, expected: FieldType) {
        if (actual != expected) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: fieldId=$fieldId has fieldType=$actual, expected $expected"
            )
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
            when (field.fieldType) {
                FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE -> {
                    if (field.optionIds.isNullOrEmpty()) {
                        throw ApiErrorException.BadRequestException(
                            "Invalid payload: fieldId=${field.fieldId} (${field.fieldType}) requires at least one option"
                        )
                    }
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

    private companion object {
        const val MAX_DEFINITIONS_PER_TEAM = 500
    }
}
