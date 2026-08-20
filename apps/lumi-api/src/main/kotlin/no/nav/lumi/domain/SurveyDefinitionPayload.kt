package no.nav.lumi.domain

import kotlinx.serialization.Serializable

@Serializable
data class SurveyDefinitionPayload(
    val surveyType: SurveyType,
    val fields: List<SubmissionFieldDefinitionPayload>
) {
    fun toSurveyDefinition(surveyId: String): SurveyDefinition {
        return SurveyDefinition(
            surveyId = surveyId,
            surveyType = surveyType,
            fields = fields.map { field ->
                FieldDefinition(
                    fieldId = field.fieldId,
                    fieldType = field.fieldType,
                    ratingVariant = field.ratingVariant,
                    ratingScale = field.ratingScale,
                    optionIds = field.optionIds,
                    maxSelections = field.maxSelections,
                )
            }
        )
    }
}

@Serializable
data class SubmissionFieldDefinitionPayload(
    val fieldId: String,
    val fieldType: FieldType,
    val ratingVariant: RatingVariant? = null,
    val ratingScale: Int? = null,
    val optionIds: List<String>? = null,
    val maxSelections: Int? = null,
)

@Serializable
data class FeedbackSubmissionV2(
    val schemaVersion: Int,
    val surveyId: String,
    val surveyType: SurveyType,
    val submittedAt: String,
    val startedAt: String? = null,
    val timeToCompleteMs: Long? = null,
    val deduplicationKey: String,
    val definition: SurveyDefinitionPayload,
    val context: SubmissionContextV1? = null,
    val answers: List<Answer>
)
