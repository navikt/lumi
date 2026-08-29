package no.nav.lumi.validation

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.AnalysisColumnType
import no.nav.lumi.domain.AnalysisDimensionRegistry
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SURVEY_FLOW_EVALUATOR_VERSION
import no.nav.lumi.domain.SURVEY_FLOW_SCHEMA_VERSION
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyFlowCondition
import no.nav.lumi.domain.SurveyFlowConditionSource
import no.nav.lumi.domain.SurveyFlowDefinitionV1
import no.nav.lumi.domain.SurveyFlowOperator

object SurveyFlowValidator {
    fun validate(flow: SurveyFlowDefinitionV1, definition: SurveyDefinition) {
        if (flow.schemaVersion != SURVEY_FLOW_SCHEMA_VERSION) {
            invalid("flow.schemaVersion must be $SURVEY_FLOW_SCHEMA_VERSION")
        }
        if (flow.evaluatorVersion != SURVEY_FLOW_EVALUATOR_VERSION) {
            invalid("flow.evaluatorVersion must be $SURVEY_FLOW_EVALUATOR_VERSION")
        }

        val definitionFieldIds = definition.fields.map(FieldDefinition::fieldId)
        val flowFieldIds = flow.fields.map { it.fieldId }
        if (flowFieldIds != definitionFieldIds) {
            invalid("flow.fields must match definition.fields in order")
        }
        if (flowFieldIds.distinct().size != flowFieldIds.size) {
            invalid("flow.fields.fieldId must be unique")
        }

        val definitionById = definition.fields.associateBy(FieldDefinition::fieldId)
        val priorFieldIds = mutableSetOf<String>()
        flow.fields.forEach { field ->
            val visibleIf = field.visibleIf
            if (visibleIf != null) {
                if (visibleIf.conditions.isEmpty() || visibleIf.conditions.size > MAX_CONDITIONS_PER_FIELD) {
                    invalid("flow visibleIf.conditions must contain between 1 and $MAX_CONDITIONS_PER_FIELD entries")
                }
                visibleIf.conditions.forEach { condition ->
                    validateCondition(condition, priorFieldIds, definitionById)
                }
            }
            priorFieldIds += field.fieldId
        }
    }

    private fun validateCondition(
        condition: SurveyFlowCondition,
        priorFieldIds: Set<String>,
        definitionById: Map<String, FieldDefinition>,
    ) {
        if (condition.key.isBlank() || condition.key.length > MAX_KEY_LENGTH) {
            invalid("flow condition key must be non-blank and at most $MAX_KEY_LENGTH characters")
        }

        if (condition.operator == SurveyFlowOperator.EXISTS) {
            if (condition.value != null) invalid("EXISTS flow conditions must not include value")
        } else {
            val value = condition.value
            if (value == null || value is JsonNull || value !is JsonPrimitive) {
                invalid("${condition.operator} flow conditions require a scalar value")
            }
            if (!value.isString && value.booleanOrNull == null && value.doubleOrNull?.isFinite() != true) {
                invalid("flow condition value must be a finite string, number or boolean")
            }
            if (value.isString && value.content.length > MAX_STRING_VALUE_LENGTH) {
                invalid("flow string condition value must be at most $MAX_STRING_VALUE_LENGTH characters")
            }
        }

        if (condition.source == SurveyFlowConditionSource.ANSWER) {
            if (condition.key !in priorFieldIds) {
                invalid("ANSWER flow conditions must reference an earlier field")
            }
            val referenced = definitionById.getValue(condition.key)
            if (condition.operator !in allowedOperators(referenced.fieldType)) {
                invalid("flow operator ${condition.operator} is not supported for ${referenced.fieldType}")
            }
            validateAnswerValue(condition, referenced)
        } else {
            validateMetadataCondition(condition)
        }
    }

    private fun validateAnswerValue(condition: SurveyFlowCondition, referenced: FieldDefinition) {
        if (condition.operator == SurveyFlowOperator.EXISTS) return
        val value = condition.value as JsonPrimitive
        val valid = when (referenced.fieldType) {
            FieldType.RATING -> {
                val numeric = value.doubleOrNull
                val rating = numeric
                    ?.takeIf { it.isFinite() && it % 1.0 == 0.0 && it in Int.MIN_VALUE.toDouble()..Int.MAX_VALUE.toDouble() }
                    ?.toInt()
                val minimum = if (referenced.ratingVariant == no.nav.lumi.domain.RatingVariant.NPS) 0 else 1
                val maximum = requireNotNull(referenced.ratingScale) -
                    if (referenced.ratingVariant == no.nav.lumi.domain.RatingVariant.NPS) 1 else 0
                !value.isString && rating != null && rating in minimum..maximum
            }
            FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE ->
                value.isString && value.content in referenced.optionIds.orEmpty()
            FieldType.TEXT, FieldType.DATE -> value.isString && value.content.isNotBlank()
        }
        if (!valid) invalid("flow condition value is outside the domain for ${referenced.fieldType}")
    }

    private fun validateMetadataCondition(condition: SurveyFlowCondition) {
        val dimension = AnalysisDimensionRegistry.snapshot().dimensions.singleOrNull { it.key == condition.key }
            ?: return
        val allowed = when (dimension.type) {
            AnalysisColumnType.STRING -> setOf(
                SurveyFlowOperator.EXISTS,
                SurveyFlowOperator.EQ,
                SurveyFlowOperator.NEQ,
                SurveyFlowOperator.CONTAINS,
            )
            AnalysisColumnType.INT64, AnalysisColumnType.FLOAT64 -> setOf(
                SurveyFlowOperator.EXISTS,
                SurveyFlowOperator.EQ,
                SurveyFlowOperator.NEQ,
                SurveyFlowOperator.GT,
                SurveyFlowOperator.LT,
            )
            AnalysisColumnType.BOOL, AnalysisColumnType.DATE, AnalysisColumnType.TIMESTAMP -> setOf(
                SurveyFlowOperator.EXISTS,
                SurveyFlowOperator.EQ,
                SurveyFlowOperator.NEQ,
            )
        }
        if (condition.operator !in allowed) {
            invalid("flow operator ${condition.operator} is not supported for metadata ${condition.key}")
        }
        if (condition.operator == SurveyFlowOperator.EXISTS) return
        val value = condition.value as JsonPrimitive
        if (dimension.type == AnalysisColumnType.STRING && !value.isString) {
            invalid("flow condition value must be a string for metadata ${condition.key}")
        }
        if (
            condition.operator in setOf(SurveyFlowOperator.EQ, SurveyFlowOperator.NEQ) &&
            dimension.allowedValues.isNotEmpty() &&
            value.content !in dimension.allowedValues
        ) {
            invalid("flow condition value is outside the domain for metadata ${condition.key}")
        }
    }

    private fun allowedOperators(fieldType: FieldType): Set<SurveyFlowOperator> = when (fieldType) {
        FieldType.RATING -> setOf(
            SurveyFlowOperator.EXISTS,
            SurveyFlowOperator.EQ,
            SurveyFlowOperator.NEQ,
            SurveyFlowOperator.GT,
            SurveyFlowOperator.LT,
        )
        FieldType.SINGLE_CHOICE, FieldType.TEXT, FieldType.DATE -> setOf(
            SurveyFlowOperator.EXISTS,
            SurveyFlowOperator.EQ,
            SurveyFlowOperator.NEQ,
            SurveyFlowOperator.CONTAINS,
        )
        FieldType.MULTI_CHOICE -> setOf(
            SurveyFlowOperator.EXISTS,
            SurveyFlowOperator.CONTAINS,
        )
    }

    private fun invalid(message: String): Nothing =
        throw ApiErrorException.BadRequestException("Invalid payload: $message")

    private const val MAX_CONDITIONS_PER_FIELD = 50
    private const val MAX_KEY_LENGTH = 200
    private const val MAX_STRING_VALUE_LENGTH = 2_048
}
