package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import java.math.BigDecimal

const val SURVEY_FLOW_SCHEMA_VERSION = 1
const val SURVEY_FLOW_EVALUATOR_VERSION = "visible-if-v1"

@Serializable
enum class SurveyFlowCombinator {
    ALL,
    ANY,
}

@Serializable
enum class SurveyFlowConditionSource {
    ANSWER,
    METADATA,
}

@Serializable
enum class SurveyFlowOperator {
    EQ,
    NEQ,
    GT,
    LT,
    CONTAINS,
    EXISTS,
}

@Serializable
data class SurveyFlowCondition(
    val source: SurveyFlowConditionSource,
    val key: String,
    val operator: SurveyFlowOperator,
    val value: JsonElement? = null,
)

@Serializable
data class SurveyVisibleIfDefinition(
    val combinator: SurveyFlowCombinator,
    val conditions: List<SurveyFlowCondition>,
)

@Serializable
data class SurveyFlowFieldDefinition(
    val fieldId: String,
    val visibleIf: SurveyVisibleIfDefinition? = null,
)

@Serializable
data class SurveyFlowDefinitionV1(
    val schemaVersion: Int,
    val evaluatorVersion: String,
    val fields: List<SurveyFlowFieldDefinition>,
) {
    fun normalized(): SurveyFlowDefinitionV1 = copy(
        fields = fields.map { field ->
            field.copy(
                visibleIf = field.visibleIf?.copy(
                    conditions = field.visibleIf.conditions.sortedWith(SURVEY_FLOW_CONDITION_COMPARATOR),
                ),
            )
        },
    )

    fun computeHash(): String {
        val normalized = normalized()
        return AnalysisCanonicalHash.digest(
            domain = "survey-visible-if-flow-v1",
            parts = buildList {
                add(normalized.schemaVersion.toString())
                add(normalized.evaluatorVersion)
                normalized.fields.forEach { field ->
                    add(field.fieldId)
                    val visibleIf = field.visibleIf
                    if (visibleIf == null) {
                        add("UNCONDITIONAL")
                    } else {
                        add("CONDITIONAL")
                        add(visibleIf.combinator.name)
                        visibleIf.conditions.forEach { condition ->
                            add(condition.source.name)
                            add(condition.key)
                            add(condition.operator.name)
                            add(condition.valueCanonicalType())
                            add(condition.valueCanonicalContent())
                        }
                    }
                }
            },
        )
    }
}

private val SURVEY_FLOW_CONDITION_COMPARATOR = compareBy<SurveyFlowCondition>(
    { it.source.name },
    SurveyFlowCondition::key,
    { it.operator.name },
    SurveyFlowCondition::valueCanonicalType,
    SurveyFlowCondition::valueCanonicalContent,
)

private fun SurveyFlowCondition.valueCanonicalType(): String = when (val primitive = value as? JsonPrimitive) {
    null -> "NONE"
    else -> when {
        primitive.isString -> "STRING"
        primitive.booleanOrNull != null -> "BOOLEAN"
        else -> "NUMBER"
    }
}

private fun SurveyFlowCondition.valueCanonicalContent(): String = when (val primitive = value as? JsonPrimitive) {
    null -> ""
    else -> when {
        primitive.isString -> primitive.content
        primitive.booleanOrNull != null -> primitive.booleanOrNull.toString()
        else -> canonicalNumber(primitive.content)
    }
}

private fun canonicalNumber(value: String): String {
    val number = BigDecimal(value).stripTrailingZeros()
    return if (number.compareTo(BigDecimal.ZERO) == 0) "0" else number.toPlainString()
}
