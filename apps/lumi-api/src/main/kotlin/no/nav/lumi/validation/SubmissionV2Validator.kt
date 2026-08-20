package no.nav.lumi.validation

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackSubmissionV2

object SubmissionV2Validator {
    fun validateSubmissionV2(submission: FeedbackSubmissionV2) {
        SubmissionValidator.validateCommonSubmission(
            schemaVersion = submission.schemaVersion,
            expectedSchemaVersion = 2,
            surveyId = submission.surveyId,
            submittedAt = submission.submittedAt,
            startedAt = submission.startedAt,
            deduplicationKey = submission.deduplicationKey,
            context = submission.context,
            answers = submission.answers
        )

        if (submission.surveyType != submission.definition.surveyType) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: surveyType must match definition.surveyType"
            )
        }

        val definition = submission.definition.toSurveyDefinition(submission.surveyId)
        SurveyDefinitionValidator.validateDefinition(definition)
        SpecializedSurveyContractValidator.validateDefinition(
            surveyType = submission.surveyType,
            fields = submission.definition.fields
        )
        SpecializedSurveyContractValidator.validateAnswers(
            surveyType = submission.surveyType,
            answers = submission.answers,
            definitionValidated = true,
        )

        val fieldIds = definition.fields.map { it.fieldId }.toSet()
        val invalidFieldIds = submission.answers.map { it.fieldId }.filterNot(fieldIds::contains)
        if (invalidFieldIds.isNotEmpty()) {
            throw ApiErrorException.BadRequestException(
                "Invalid payload: answers.fieldId must exist in definition.fields"
            )
        }

        SurveyDefinitionValidator.validateAnswersAgainstDefinition(
            definition = definition,
            answers = submission.answers,
            surveyId = submission.surveyId
        )
    }
}
