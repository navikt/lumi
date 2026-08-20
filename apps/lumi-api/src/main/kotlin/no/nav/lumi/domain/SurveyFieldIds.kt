package no.nav.lumi.domain

/**
 * Canonical answer field IDs shared by specialized widget templates and analytics.
 * Submission validation rejects specialized surveys that repurpose these fields.
 */
object SpecializedSurveyFieldIds {
    const val TASK = "task"
    const val SUCCESS = "success"
    const val BLOCKER = "blocker"
    const val PRIORITY = "priority"

    const val LEGACY_DISCOVERY_TASK = "discoveredTask"
    const val LEGACY_SUCCESS = "taskSuccess"
    const val LEGACY_PRIORITY = "priorities"

    fun findTask(surveyType: SurveyType?, answers: List<Answer>): Answer? =
        answers.firstOrNull { it.fieldId == TASK }
            ?: if (surveyType == SurveyType.DISCOVERY) {
                answers.firstOrNull { it.fieldId == LEGACY_DISCOVERY_TASK }
            } else null

    fun findSuccess(answers: List<Answer>): Answer? =
        answers.firstOrNull { it.fieldId == SUCCESS }
            ?: answers.firstOrNull { it.fieldId == LEGACY_SUCCESS }

    fun findPriority(answers: List<Answer>): Answer? =
        answers.firstOrNull { it.fieldId == PRIORITY }
            ?: answers.firstOrNull { it.fieldId == LEGACY_PRIORITY }
}
