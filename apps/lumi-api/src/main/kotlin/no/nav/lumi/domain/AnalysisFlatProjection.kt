package no.nav.lumi.domain

import kotlinx.serialization.json.*
import no.nav.lumi.validation.SurveyFlowValidator
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** Typed internal facts, not an HTTP model or a replacement for the source snapshot contract. */
internal sealed interface AnalysisStructuredValue {
    data class Rating(val value: Int) : AnalysisStructuredValue
    data class Choice(val optionId: String) : AnalysisStructuredValue
    data class Choices(val optionIds: List<String>) : AnalysisStructuredValue
}

/** Already eligible V2 facts. Legacy cutover/exclusion accounting belongs to the source adapter. */
internal data class AnalysisProjectionSubmission(
    val snapshotRowRef: String,
    val team: String,
    val app: String,
    val surveyId: String,
    val storedAt: Instant,
    val definitionHash: String?,
    val flowHash: String?,
    val answers: Map<String, AnalysisStructuredValue>,
    val dimensions: Map<String, String> = emptyMap(),
)

/** Immutable source contracts must be fetched by their exact ingest-pinned hashes. */
internal data class AnalysisProjectionContract(
    val team: String,
    val app: String,
    val definition: SurveyDefinition,
    val flow: SurveyFlowDefinitionV1,
)

/** Real derivation belongs to the trusted transport; this slice supplies no implementation. */
internal interface AnalysisProjectionKeys {
    fun responseKey(productId: String, snapshotRowRef: String): String
    fun answerKey(productId: String, snapshotRowRef: String, fieldId: String): String
}

internal data class AnalysisProjectionContext(
    val candidateId: String,
    val sourceSnapshotAt: Instant,
    val sourceRetentionStart: Instant,
)

internal data class AnalysisFlatTable(val schema: AnalysisResourceSchemaV1, val rows: List<JsonObject>)
internal data class AnalysisFlatCandidate(val tables: List<AnalysisFlatTable>)

/**
 * Pure candidate construction from resolver-owned scope. No persistence,
 * activation, authorization or production source/key adapter is implemented here.
 * A failure returns no partial candidate. The publisher must validate/fence the
 * effective generation, recheck freshness, and supply the publication manifest.
 */
internal class AnalysisFlatProjector {
    companion object {
        // This in-memory rehearsal is intentionally bounded, not a bulk transport.
        const val MAX_SUBMISSIONS = 10_000
        const val MAX_OUTPUT_CELLS = 1_000_000L
    }

    fun project(
        scope: EffectivePublicationSpecification,
        context: AnalysisProjectionContext,
        submissions: List<AnalysisProjectionSubmission>,
        contracts: List<AnalysisProjectionContract>,
        keys: AnalysisProjectionKeys,
    ): AnalysisFlatCandidate {
        require(context.candidateId.isNotBlank()) { "candidate identity is required" }
        require(context.sourceRetentionStart <= context.sourceSnapshotAt) { "invalid source window" }
        require(submissions.size <= MAX_SUBMISSIONS) { "candidate input budget exceeded" }
        require(scope.targetRelease == scope.upperAllowlistRelease) { "subtractive rebuild requires a dedicated publisher" }
        val minimum = maxOf(context.sourceRetentionStart, when (scope.retention) {
            AnalysisProductRetention.SOURCE_MAXIMUM -> context.sourceRetentionStart
            AnalysisProductRetention.DAYS_30 -> context.sourceSnapshotAt.minus(30, ChronoUnit.DAYS)
            AnalysisProductRetention.DAYS_90 -> context.sourceSnapshotAt.minus(90, ChronoUnit.DAYS)
            AnalysisProductRetention.DAYS_180 -> context.sourceSnapshotAt.minus(180, ChronoUnit.DAYS)
        })
        val maximum = minOf(context.sourceSnapshotAt, scope.dataCutoffAt ?: context.sourceSnapshotAt)
        val sources = scope.sources.filter { it.membershipAllowed }.associateBy { it.app to it.surveyId }
        val selected = submissions.filter { row ->
            row.team == scope.team && (row.app to row.surveyId) in sources &&
                row.storedAt >= minimum && row.storedAt <= maximum
        }.sortedWith(compareBy({ it.app }, { it.surveyId }, { it.storedAt }, { it.snapshotRowRef }))
        require(selected.map { it.snapshotRowRef }.distinct().size == selected.size) { "duplicate source reference" }
        val tables = scope.resources.filter { it.kind != AnalysisResourceKind.MANIFEST }
            .associate { it.name to mutableListOf<JsonObject>() }
        val responseKeys = mutableSetOf<String>()
        val answerKeys = mutableSetOf<String>()
        val observed = mutableMapOf<Triple<String, String, String>, MutableList<Instant>>()
        val contractsByKey = contracts.filter { it.team == scope.team && (it.app to it.definition.surveyId) in sources }
            .groupBy { listOf(it.app, it.definition.surveyId, it.definition.computeHash(), it.flow.computeHash()) }
        val validatedContracts = mutableMapOf<List<String?>, AnalysisProjectionContract>()

        selected.forEach { row ->
            val source = sources.getValue(row.app to row.surveyId)
            val definition = source.definitions.singleOrNull { it.definitionHash == row.definitionHash }
                ?: error("source definition is not pinned")
            val pin = definition.flows.singleOrNull { it.flowHash == row.flowHash }
                ?: error("source flow is not pinned")
            val contractKey = listOf(row.app, row.surveyId, row.definitionHash, row.flowHash)
            val contract = validatedContracts.getOrPut(contractKey) {
                val exact = contractsByKey[contractKey]?.singleOrNull()
                    ?: error("exact source contract is unavailable or ambiguous")
                SurveyFlowValidator.validate(exact.flow, exact.definition)
                require(pin.evaluatorVersion == exact.flow.evaluatorVersion) { "flow evaluator mismatch" }
                validatePins(definition, pin, exact, scope, source)
                exact
            }
            val responseKey = keys.responseKey(scope.productId, row.snapshotRowRef)
            require(responseKey.isNotBlank() && responseKeys.add(responseKey)) { "duplicate or empty response key" }
            val common = commonValues(scope, context, source, row, responseKey)
            val dimensions = scope.dimensions.associate { dimension ->
                val value = if (dimension.mode == EffectiveFieldMode.INCLUDED) row.dimensions[dimension.definition.key] else null
                require(value == null || value in dimension.definition.allowedValues) { "dimension outside pinned domain" }
                require(dimension.definition.type == AnalysisColumnType.STRING) { "unsupported dimension type" }
                "dimension:${dimension.definition.key}" to value.json()
            }
            val wide = common.toMutableMap().apply { putAll(dimensions) }
            definition.fields.forEach { field ->
                // Removed fields do not occur in the effective definition; their
                // old physical columns are filled with NULL by render().
                val value = row.answers[field.fieldId]
                validateValue(field, value)
                val flowField = contract.flow.fields.singleOrNull { it.fieldId == field.fieldId }
                val applicable = field.presence == AnalysisFieldPresence.PRESENT &&
                    visible(flowField?.visibleIf, row)
                require(applicable || value == null) { "answer exists outside applicable scope" }
                val prefix = "field:${field.fieldId}:"
                wide[prefix + "applicable"] = JsonPrimitive(applicable)
                wide[prefix + "rating"] = (value as? AnalysisStructuredValue.Rating)?.value.json()
                wide[prefix + "option_id"] = (value as? AnalysisStructuredValue.Choice)?.optionId.json()
                wide[prefix + "selection_count"] = (value as? AnalysisStructuredValue.Choices)?.optionIds?.size.json()
                field.availableOptionIds.forEach { option ->
                    wide[prefix + "option:$option:selected"] = (value as? AnalysisStructuredValue.Choices)
                        ?.let { JsonPrimitive(option in it.optionIds) } ?: JsonNull
                }
                if (value != null) {
                    val answerKey = keys.answerKey(scope.productId, row.snapshotRowRef, field.fieldId)
                    require(answerKey.isNotBlank() && answerKeys.add(answerKey)) { "duplicate or empty answer key" }
                    val options = when (value) {
                        is AnalysisStructuredValue.Rating -> listOf(null)
                        is AnalysisStructuredValue.Choice -> listOf(value.optionId)
                        is AnalysisStructuredValue.Choices -> value.optionIds.sorted().ifEmpty { listOf(null) }
                    }
                    options.forEach { option ->
                        val values = common + dimensions + mapOf(
                            "answer_key" to JsonPrimitive(answerKey),
                            "field_id" to JsonPrimitive(field.fieldId),
                            "field_type" to JsonPrimitive(checkNotNull(field.fieldType).name),
                            "field_metadata_hash" to JsonPrimitive(metadataHash(scope, source, definition, field)),
                            "value_kind" to JsonPrimitive(when {
                                value is AnalysisStructuredValue.Rating -> "RATING"
                                value is AnalysisStructuredValue.Choices && value.optionIds.isEmpty() -> "EMPTY_SELECTION"
                                else -> "OPTION"
                            }),
                            "rating_value" to (value as? AnalysisStructuredValue.Rating)?.value.json(),
                            "option_id" to option.json(),
                            "option_metadata_hash" to option?.let { metadataHash(scope, source, definition, field, it) }.json(),
                            "selection_count" to when (value) {
                                is AnalysisStructuredValue.Rating -> JsonNull
                                is AnalysisStructuredValue.Choice -> JsonPrimitive(1)
                                is AnalysisStructuredValue.Choices -> JsonPrimitive(value.optionIds.size)
                            },
                        )
                        append(scope, tables, "answers_long_v1", values)
                    }
                }
            }
            // Values for a removed/unselected field are never copied or used for predicates.
            append(scope, tables, AnalysisPhysicalNames.resourceName(source.app, source.surveyId), wide)
            observed.getOrPut(Triple(source.app, source.surveyId, definition.definitionHash)) { mutableListOf() }.add(row.storedAt)
        }

        sources.values.sortedWith(compareBy({ it.app }, { it.surveyId })).forEach { source ->
            source.definitions.forEach { definition ->
                val dates = observed[Triple(source.app, source.surveyId, definition.definitionHash)].orEmpty()
                definition.fields.filter { it.presence == AnalysisFieldPresence.PRESENT }.forEach { field ->
                    (listOf<String?>(null) + field.availableOptionIds).forEach { option ->
                        val rating = option == null && field.fieldType == FieldType.RATING
                        val minimumRating = if (field.ratingVariant == RatingVariant.NPS) 0 else 1
                        val values = mapOf(
                            "product_id" to JsonPrimitive(scope.productId), "product_release" to JsonPrimitive(scope.targetRelease),
                            "product_snapshot_id" to JsonPrimitive(context.candidateId), "team_slug" to JsonPrimitive(scope.team),
                            "app" to JsonPrimitive(source.app), "survey_id" to JsonPrimitive(source.surveyId),
                            "definition_hash" to JsonPrimitive(definition.definitionHash),
                            "metadata_hash" to JsonPrimitive(metadataHash(scope, source, definition, field, option)),
                            "entry_kind" to JsonPrimitive(if (option == null) "FIELD" else "OPTION"),
                            "field_id" to JsonPrimitive(field.fieldId), "field_type" to JsonPrimitive(checkNotNull(field.fieldType).name),
                            "rating_variant" to field.ratingVariant?.name?.takeIf { rating }.json(),
                            "rating_scale" to field.ratingScale?.takeIf { rating }.json(),
                            "rating_min" to minimumRating.takeIf { rating }.json(),
                            "rating_max" to field.ratingScale?.let { it - if (minimumRating == 0) 1 else 0 }?.takeIf { rating }.json(),
                            "max_selections" to field.maxSelections.json(),
                            "option_id" to option.json(), "option_ordinal" to option?.let { field.availableOptionIds.indexOf(it) }.json(),
                            "label_source" to JsonPrimitive("UNKNOWN"), "is_current_label" to JsonPrimitive(false),
                            "first_observed_date" to dates.minOrNull()?.osloDate().json(),
                            "last_observed_date" to dates.maxOrNull()?.osloDate().json(),
                        )
                        append(scope, tables, "field_catalog_v1", values)
                    }
                }
            }
        }
        return AnalysisFlatCandidate(scope.resources.filter { it.kind != AnalysisResourceKind.MANIFEST }.map {
            AnalysisFlatTable(it, tables.getValue(it.name).toList())
        })
    }

    private fun validatePins(
        definition: AnalysisDefinitionPinV1, pin: AnalysisFlowPinV1, contract: AnalysisProjectionContract,
        scope: EffectivePublicationSpecification, source: EffectiveSourceProjection,
    ) {
        require(contract.definition.surveyType == source.surveyType) { "source survey type mismatch" }
        val selected = source.fields.filter { it.mode == EffectiveFieldMode.INCLUDED }.map { it.fieldId }.toSet()
        require(definition.fields.map { it.fieldId }.toSet() == selected) { "effective field scope mismatch" }
        definition.fields.forEach { field ->
            val actual = contract.definition.fields.singleOrNull { it.fieldId == field.fieldId }
            if (field.presence == AnalysisFieldPresence.ABSENT) {
                require(actual == null) { "absent field exists in source contract" }
            } else {
                require(actual != null && actual.fieldType == field.fieldType && actual.ratingVariant == field.ratingVariant &&
                    actual.ratingScale == field.ratingScale && actual.maxSelections == field.maxSelections &&
                    actual.optionIds.orEmpty() == field.availableOptionIds) { "field pin mismatch" }
                val conditions = contract.flow.fields.single { it.fieldId == field.fieldId }.visibleIf?.conditions.orEmpty()
                val dependencies = conditions.map { AnalysisFlowDependencyV1(AnalysisFlowDependencySource.valueOf(it.source.name), it.key) }.toSet()
                require(dependencies == pin.dependenciesByField.single { it.fieldId == field.fieldId }.dependencies.toSet()) {
                    "flow dependencies differ from release"
                }
                dependencies.forEach { dependency ->
                    require(when (dependency.source) {
                        AnalysisFlowDependencySource.ANSWER -> dependency.key in selected
                        AnalysisFlowDependencySource.METADATA -> scope.dimensions.any {
                            it.mode == EffectiveFieldMode.INCLUDED && it.definition.key == dependency.key
                        }
                    }) { "predicate depends on unselected data" }
                }
            }
        }
    }

    private fun validateValue(field: AnalysisDefinitionFieldPinV1, value: AnalysisStructuredValue?) {
        if (value == null) return
        require(field.presence == AnalysisFieldPresence.PRESENT) { "answer for absent field" }
        require(when (value) {
            is AnalysisStructuredValue.Rating -> {
                val minimum = if (field.ratingVariant == RatingVariant.NPS) 0 else 1
                field.fieldType == FieldType.RATING && field.ratingScale != null &&
                    value.value in minimum..(field.ratingScale - if (minimum == 0) 1 else 0)
            }
            is AnalysisStructuredValue.Choice -> field.fieldType == FieldType.SINGLE_CHOICE && value.optionId in field.availableOptionIds
            is AnalysisStructuredValue.Choices -> field.fieldType == FieldType.MULTI_CHOICE &&
                value.optionIds.distinct().size == value.optionIds.size &&
                value.optionIds.all { it in field.availableOptionIds } &&
                value.optionIds.size <= (field.maxSelections ?: field.availableOptionIds.size)
        }) { "answer outside pinned field domain" }
    }

    private fun visible(condition: SurveyVisibleIfDefinition?, row: AnalysisProjectionSubmission): Boolean {
        if (condition == null) return true
        val results = condition.conditions.map { leaf ->
            val actual: Any? = if (leaf.source == SurveyFlowConditionSource.METADATA) row.dimensions[leaf.key] else when (val answer = row.answers[leaf.key]) {
                is AnalysisStructuredValue.Rating -> answer.value
                is AnalysisStructuredValue.Choice -> answer.optionId
                is AnalysisStructuredValue.Choices -> answer.optionIds
                null -> null
            }
            val expected = leaf.value as? JsonPrimitive
            val equal = when (actual) {
                is String -> expected?.isString == true && actual == expected.content
                is Int -> expected?.isString == false && actual.toDouble() == expected.doubleOrNull
                else -> false
            }
            when (leaf.operator) {
                SurveyFlowOperator.EXISTS -> actual != null
                SurveyFlowOperator.EQ -> equal
                SurveyFlowOperator.NEQ -> !equal
                SurveyFlowOperator.GT -> actual is Int && expected?.isString == false && expected.doubleOrNull?.let { actual > it } == true
                SurveyFlowOperator.LT -> actual is Int && expected?.isString == false && expected.doubleOrNull?.let { actual < it } == true
                SurveyFlowOperator.CONTAINS -> expected?.isString == true && when (actual) {
                    is String -> actual.contains(expected.content, ignoreCase = true)
                    is List<*> -> expected.content in actual
                    else -> false
                }
            }
        }
        return if (condition.combinator == SurveyFlowCombinator.ALL) results.all { it } else results.any { it }
    }

    private fun commonValues(
        scope: EffectivePublicationSpecification, context: AnalysisProjectionContext, source: EffectiveSourceProjection,
        row: AnalysisProjectionSubmission, responseKey: String,
    ): Map<String, JsonElement> = mapOf(
        "response_key" to JsonPrimitive(responseKey), "product_id" to JsonPrimitive(scope.productId),
        "product_release" to JsonPrimitive(scope.targetRelease), "product_snapshot_id" to JsonPrimitive(context.candidateId),
        "team_slug" to JsonPrimitive(scope.team), "app" to JsonPrimitive(source.app), "survey_id" to JsonPrimitive(source.surveyId),
        "survey_type" to JsonPrimitive(source.surveyType.name), "submitted_date" to JsonPrimitive(row.storedAt.osloDate()),
        "submitted_hour" to row.storedAt.truncatedTo(ChronoUnit.HOURS).toString().takeIf { scope.submittedHourMode == EffectiveFieldMode.INCLUDED }.json(),
        "definition_hash" to row.definitionHash.json(), "definition_status" to JsonPrimitive("REGISTERED"),
        "flow_hash" to row.flowHash.json(), "flow_status" to JsonPrimitive("PINNED"),
    )

    private fun metadataHash(
        scope: EffectivePublicationSpecification, source: EffectiveSourceProjection, definition: AnalysisDefinitionPinV1,
        field: AnalysisDefinitionFieldPinV1, option: String? = null,
    ) = AnalysisCanonicalHash.digest("analysis-projected-unknown-metadata-v1", buildList {
        addAll(listOf(scope.team, source.app, source.surveyId, definition.definitionHash, field.fieldId,
            field.fieldType!!.name, field.ratingVariant?.name ?: "<null>", field.ratingScale?.toString() ?: "<null>",
            field.maxSelections?.toString() ?: "<null>", if (option == null) "FIELD" else "OPTION", "UNKNOWN", "<null>", "<null>"))
        addAll(field.availableOptionIds)
        add(option ?: "<null>")
    })

    private fun append(scope: EffectivePublicationSpecification, tables: Map<String, MutableList<JsonObject>>, name: String, values: Map<String, JsonElement>) {
        val schema = scope.resources.single { it.name == name }
        val cellCount = scope.resources.sumOf { it.columns.size.toLong() * (tables[it.name]?.size ?: 0) }
        require(cellCount + schema.columns.size <= MAX_OUTPUT_CELLS) { "candidate output budget exceeded" }
        val row = schema.columns.associate { column ->
            val value = values[column.logicalId] ?: JsonNull
            require(value != JsonNull || column.nullable) { "missing required output column" }
            require(value is JsonPrimitive) { "non-scalar output" }
            require(value == JsonNull || when (column.type) {
                AnalysisColumnType.STRING -> value.isString
                AnalysisColumnType.INT64 -> !value.isString && value.longOrNull != null
                AnalysisColumnType.BOOL -> !value.isString && value.booleanOrNull != null
                AnalysisColumnType.FLOAT64 -> !value.isString && value.doubleOrNull?.isFinite() == true
                AnalysisColumnType.DATE -> value.isString && runCatching { LocalDate.parse(value.content) }.isSuccess
                AnalysisColumnType.TIMESTAMP -> value.isString && runCatching { Instant.parse(value.content) }.isSuccess
            }) { "output column type mismatch" }
            column.name to value
        }
        tables.getValue(name).add(JsonObject(row))
    }
}

private fun String?.json(): JsonElement = this?.let(::JsonPrimitive) ?: JsonNull
private fun Int?.json(): JsonElement = this?.let(::JsonPrimitive) ?: JsonNull
private fun Instant.osloDate(): String = atZone(ZoneId.of("Europe/Oslo")).toLocalDate().toString()
