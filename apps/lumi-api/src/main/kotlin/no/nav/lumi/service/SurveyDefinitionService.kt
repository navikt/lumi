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
        val incomingHash = incomingDefinition.computeHash()

        val stored = repository.findByTeamAndSurveyId(team, submission.surveyId)
        if (stored != null) {
            validateAnswersAgainstStoredDefinition(stored, submission)
            if (stored.definitionHash == incomingHash) {
                return RegistrationResult(submission.surveyId, stored.definitionHash)
            }

            throwDefinitionConflict(submission.surveyId, diff(stored.definition, incomingDefinition))
        }

        if (repository.countByTeam(team) >= MAX_DEFINITIONS_PER_TEAM) {
            throw ApiErrorException.TooManyRequestsException(
                "Definition limit exceeded for team=$team (max=$MAX_DEFINITIONS_PER_TEAM)"
            )
        }

        val inserted = repository.insertIgnore(
            team = team,
            definition = incomingDefinition,
            definitionHash = incomingHash
        )

        if (inserted) {
            return RegistrationResult(submission.surveyId, incomingHash)
        }

        val existingAfterRace = repository.findByTeamAndSurveyId(team, submission.surveyId)
            ?: throw ApiErrorException.InternalServerErrorException(
                "Failed to resolve survey definition after concurrent insert for surveyId=${submission.surveyId}"
            )

        validateAnswersAgainstStoredDefinition(existingAfterRace, submission)
        if (existingAfterRace.definitionHash == incomingHash) {
            return RegistrationResult(submission.surveyId, existingAfterRace.definitionHash)
        }

        throwDefinitionConflict(submission.surveyId, diff(existingAfterRace.definition, incomingDefinition))
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

    private fun throwDefinitionConflict(surveyId: String, definitionDiff: DefinitionDiff): Nothing {
        throw ApiErrorException.ConflictException(
            "Survey definition conflict for surveyId=$surveyId: ${definitionDiff.describe()}"
        )
    }

    private companion object {
        const val MAX_DEFINITIONS_PER_TEAM = 500
    }
}
