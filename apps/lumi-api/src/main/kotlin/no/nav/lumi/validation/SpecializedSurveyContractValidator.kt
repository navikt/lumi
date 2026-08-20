package no.nav.lumi.validation

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.Answer
import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SubmissionFieldDefinitionPayload
import no.nav.lumi.domain.SpecializedSurveyFieldIds
import no.nav.lumi.domain.SurveyType

/**
 * Analytics for specialized survey types relies on a small, explicit field
 * contract. Reject mismatches at ingestion so a seemingly successful survey
 * can never produce an empty or misleading dashboard.
 */
object SpecializedSurveyContractValidator {
    data class AuthoringField(
        val id: String,
        val type: FieldType,
        val optionIds: List<String> = emptyList(),
        val optionLabels: List<String> = emptyList(),
        val required: Boolean = false,
        val conditionallyVisible: Boolean = false,
        val maxSelections: Int? = null,
    )

    private data class RequiredField(
        val id: String,
        val type: FieldType,
        val optional: Boolean = false,
        val optionIds: Set<String> = emptySet()
    )

    private val successOptions = setOf("yes", "partial", "no")
    private const val TEMPLATE_OPTION_PREFIX = "__lumi_example_task__"
    private val templateOptionLabels = setOf(
        "Bytt ut med en oppgave dere vil måle",
        "Bytt ut med den første oppgaven",
        "Bytt ut med den andre oppgaven",
    )

    private val contracts = mapOf(
        SurveyType.DISCOVERY to listOf(
            RequiredField(SpecializedSurveyFieldIds.TASK, FieldType.TEXT),
            RequiredField(
                SpecializedSurveyFieldIds.SUCCESS,
                FieldType.SINGLE_CHOICE,
                optionIds = successOptions
            ),
            RequiredField(SpecializedSurveyFieldIds.BLOCKER, FieldType.TEXT, optional = true)
        ),
        SurveyType.TOP_TASKS to listOf(
            RequiredField(SpecializedSurveyFieldIds.TASK, FieldType.SINGLE_CHOICE),
            RequiredField(
                SpecializedSurveyFieldIds.SUCCESS,
                FieldType.SINGLE_CHOICE,
                optionIds = successOptions
            ),
            RequiredField(SpecializedSurveyFieldIds.BLOCKER, FieldType.TEXT, optional = true)
        ),
        SurveyType.TASK_PRIORITY to listOf(
            RequiredField(SpecializedSurveyFieldIds.PRIORITY, FieldType.MULTI_CHOICE)
        )
    )

    private val legacyContracts = mapOf(
        SurveyType.DISCOVERY to listOf(
            RequiredField("discoveredTask", FieldType.TEXT),
            RequiredField("taskSuccess", FieldType.SINGLE_CHOICE, optionIds = successOptions),
            RequiredField(SpecializedSurveyFieldIds.BLOCKER, FieldType.TEXT, optional = true)
        ),
        SurveyType.TOP_TASKS to listOf(
            RequiredField(SpecializedSurveyFieldIds.TASK, FieldType.SINGLE_CHOICE),
            RequiredField("taskSuccess", FieldType.SINGLE_CHOICE, optionIds = successOptions),
            RequiredField(SpecializedSurveyFieldIds.BLOCKER, FieldType.TEXT, optional = true)
        ),
        SurveyType.TASK_PRIORITY to listOf(
            RequiredField("priorities", FieldType.MULTI_CHOICE)
        )
    )

    private fun contractFor(
        surveyType: SurveyType,
        fieldIds: Set<String>,
        allowLegacyFieldIds: Boolean,
    ): List<RequiredField>? {
        val canonical = contracts[surveyType] ?: return null
        if (!allowLegacyFieldIds) return canonical
        val hasRequiredFields = { candidate: List<RequiredField> ->
            candidate.all { it.optional || it.id in fieldIds }
        }
        val legacy = legacyContracts[surveyType]
        return if (!hasRequiredFields(canonical) && legacy != null && hasRequiredFields(legacy)) legacy else canonical
    }

    fun validateAnswers(
        surveyType: SurveyType,
        answers: List<Answer>,
        definitionValidated: Boolean = false,
    ) {
        if (
            surveyType == SurveyType.TASK_PRIORITY &&
            answers.any { it.fieldId == SpecializedSurveyFieldIds.PRIORITY } &&
            !definitionValidated
        ) {
            invalid(
                surveyType,
                "canonical field 'priority' requires schemaVersion 2 with a validated definition"
            )
        }
        validateFields(
            surveyType = surveyType,
            fields = answers.map { answer ->
                ContractField(
                    id = answer.fieldId,
                    type = answer.fieldType,
                    optionIds = answer.question.options?.map { it.id }.orEmpty()
                )
            },
            source = "answers",
            allowLegacyFieldIds = true,
        )
        validateAnswerValues(surveyType, answers)
    }

    fun validateDefinition(
        surveyType: SurveyType,
        fields: List<SubmissionFieldDefinitionPayload>
    ) {
        validateFields(
            surveyType = surveyType,
            fields = fields.map { field ->
                ContractField(
                    id = field.fieldId,
                    type = field.fieldType,
                    optionIds = field.optionIds.orEmpty(),
                    maxSelections = field.maxSelections,
                )
            },
            source = "definition.fields",
            enforceCanonicalTaskPrioritySemantics = true,
            allowLegacyFieldIds = true,
        )
    }

    fun validateAuthoringFields(surveyType: SurveyType, fields: List<AuthoringField>) {
        validateFields(
            surveyType = surveyType,
            fields = fields.map { field ->
                ContractField(
                    id = field.id,
                    type = field.type,
                    optionIds = field.optionIds,
                    optionLabels = field.optionLabels,
                    required = field.required,
                    conditionallyVisible = field.conditionallyVisible,
                    maxSelections = field.maxSelections,
                )
            },
            source = "document",
            enforceAuthoringSemantics = true,
            enforceCanonicalTaskPrioritySemantics = true,
            allowLegacyFieldIds = false,
        )
    }

    private data class ContractField(
        val id: String,
        val type: FieldType,
        val optionIds: List<String>,
        val optionLabels: List<String> = emptyList(),
        val required: Boolean = false,
        val conditionallyVisible: Boolean = false,
        val maxSelections: Int? = null,
    )

    private fun validateFields(
        surveyType: SurveyType,
        fields: List<ContractField>,
        source: String,
        enforceAuthoringSemantics: Boolean = false,
        enforceCanonicalTaskPrioritySemantics: Boolean = false,
        allowLegacyFieldIds: Boolean,
    ) {
        if (allowLegacyFieldIds) {
            val fieldIds = fields.mapTo(mutableSetOf()) { it.id }
            val aliasPairs = buildList {
                if (surveyType == SurveyType.DISCOVERY) {
                    add(SpecializedSurveyFieldIds.TASK to SpecializedSurveyFieldIds.LEGACY_DISCOVERY_TASK)
                }
                if (surveyType == SurveyType.DISCOVERY || surveyType == SurveyType.TOP_TASKS) {
                    add(SpecializedSurveyFieldIds.SUCCESS to SpecializedSurveyFieldIds.LEGACY_SUCCESS)
                }
                if (surveyType == SurveyType.TASK_PRIORITY) {
                    add(SpecializedSurveyFieldIds.PRIORITY to SpecializedSurveyFieldIds.LEGACY_PRIORITY)
                }
            }
            aliasPairs.firstOrNull { (canonical, legacy) -> canonical in fieldIds && legacy in fieldIds }
                ?.let { (canonical, legacy) ->
                    invalid(surveyType, "$source must not include both '$canonical' and legacy alias '$legacy'")
                }
        }
        val contract = contractFor(surveyType, fields.map { it.id }.toSet(), allowLegacyFieldIds) ?: return
        val fieldsById = fields.associateBy { it.id }

        for (required in contract) {
            val actual = fieldsById[required.id]
            if (actual == null) {
                if (required.optional) continue
                invalid(surveyType, "$source must include '${required.id}'")
            }
            if (actual.type != required.type) {
                invalid(
                    surveyType,
                    "$source field '${required.id}' must be ${required.type}"
                )
            }
            if (
                required.optionIds.isNotEmpty() &&
                (actual.optionIds.size != required.optionIds.size || actual.optionIds.toSet() != required.optionIds)
            ) {
                invalid(
                    surveyType,
                    "$source field '${required.id}' must have exactly options yes, partial and no"
                )
            }
            if (enforceAuthoringSemantics && !required.optional && !actual.required) {
                invalid(surveyType, "$source field '${required.id}' must be required")
            }
            if (enforceAuthoringSemantics && !required.optional && actual.conditionallyVisible) {
                invalid(surveyType, "$source field '${required.id}' must always be visible")
            }
        }
        val usesLegacyContract = contract === legacyContracts[surveyType]
        if (
            enforceCanonicalTaskPrioritySemantics &&
            surveyType == SurveyType.TASK_PRIORITY &&
            !usesLegacyContract
        ) {
            val priorityFieldId = contract.firstOrNull { it.type == FieldType.MULTI_CHOICE && !it.optional }?.id
            val priority = priorityFieldId?.let(fieldsById::get)
            if (priority != null && priority.type == FieldType.MULTI_CHOICE) {
                if (priority.optionIds.size < 2) {
                    invalid(surveyType, "$source field 'priority' must have at least two task options")
                }
                val maxSelections = priority.maxSelections
                if (maxSelections == null || maxSelections !in 1..priority.optionIds.size) {
                    invalid(
                        surveyType,
                        "$source field 'priority' maxSelections must be between 1 and the number of task options"
                    )
                }
            }
        }
        if (enforceAuthoringSemantics && surveyType in setOf(SurveyType.TOP_TASKS, SurveyType.TASK_PRIORITY)) {
            val taskFieldId = if (surveyType == SurveyType.TOP_TASKS) {
                SpecializedSurveyFieldIds.TASK
            } else {
                SpecializedSurveyFieldIds.PRIORITY
            }
            val taskField = fieldsById[taskFieldId]
            if (
                taskField != null &&
                (taskField.optionIds.any { it.startsWith(TEMPLATE_OPTION_PREFIX) } ||
                    taskField.optionLabels.any { it.trim() in templateOptionLabels })
            ) {
                invalid(surveyType, "$source field '$taskFieldId' contains an unfinished example task")
            }
            if (
                surveyType == SurveyType.TOP_TASKS &&
                taskField != null &&
                taskField.optionIds.all { it == "other" }
            ) {
                invalid(surveyType, "$source field 'task' must include at least one known task")
            }
        }
    }

    private fun validateAnswerValues(surveyType: SurveyType, answers: List<Answer>) {
        val contract = contractFor(surveyType, answers.map { it.fieldId }.toSet(), allowLegacyFieldIds = true) ?: return
        val answersById = answers.associateBy { it.fieldId }

        for (required in contract) {
            val answer = answersById[required.id] ?: continue
            val valueMatchesField = when (required.type) {
                FieldType.TEXT -> answer.value is AnswerValue.Text
                FieldType.SINGLE_CHOICE -> answer.value is AnswerValue.SingleChoice
                FieldType.MULTI_CHOICE -> answer.value is AnswerValue.MultiChoice
                else -> false
            }
            if (!valueMatchesField) {
                invalid(
                    surveyType,
                    "answers field '${required.id}' value must match ${required.type}"
                )
            }

            when (val value = answer.value) {
                is AnswerValue.Text -> {
                    if (value.text.isBlank()) {
                        invalid(surveyType, "answers field '${required.id}' must be non-blank")
                    }
                }
                is AnswerValue.SingleChoice -> {
                    val optionIds = answer.question.options?.map { it.id }.orEmpty()
                    if (value.selectedOptionId !in optionIds) {
                        invalid(
                            surveyType,
                            "answers field '${required.id}' must select a declared option"
                        )
                    }
                }
                is AnswerValue.MultiChoice -> {
                    val optionIds = answer.question.options?.map { it.id }?.toSet().orEmpty()
                    if (value.selectedOptionIds.any { it !in optionIds }) {
                        invalid(
                            surveyType,
                            "answers field '${required.id}' must select only declared options"
                        )
                    }
                }
                else -> Unit
            }
        }
    }

    private fun invalid(surveyType: SurveyType, detail: String): Nothing {
        val wireType = when (surveyType) {
            SurveyType.DISCOVERY -> "discovery"
            SurveyType.TOP_TASKS -> "topTasks"
            SurveyType.TASK_PRIORITY -> "taskPriority"
            SurveyType.RATING -> "rating"
            SurveyType.CUSTOM -> "custom"
        }
        throw ApiErrorException.BadRequestException(
            "Invalid $wireType survey contract: $detail"
        )
    }
}
