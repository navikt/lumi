package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import java.security.MessageDigest

const val ANALYSIS_SOURCE_CATALOG_SCHEMA_VERSION = 1

@Serializable
enum class AnalysisDefinitionStatus {
    REGISTERED,
    AUTO_DERIVED,
    RETIRED,
    MISSING,
}

@Serializable
enum class AnalysisFlowStatus {
    PINNED,
    UNPINNED,
}

@Serializable
enum class AnalysisLabelSource {
    REGISTERED_METADATA,
    PRODUCT_ALIAS,
    UNKNOWN,
}

@Serializable
enum class AnalysisFlowDependencySource {
    ANSWER,
    METADATA,
}

@Serializable
data class AnalysisFlowDependencyV1(
    val source: AnalysisFlowDependencySource,
    val key: String,
)

@Serializable
enum class AnalysisCatalogWarning {
    LEGACY_DEFINITION_OBSERVED,
    HISTORICAL_DEFINITION_UNRESOLVED,
    LEGACY_FLOW_OBSERVED,
    UNKNOWN_FLOW_OBSERVED,
    DEFINITION_CONTENT_MISMATCH,
    SOURCE_ID_MISMATCH,
}

@Serializable
data class AnalysisCatalogFieldV1(
    val fieldId: String,
    val fieldType: FieldType,
    val ratingVariant: RatingVariant? = null,
    val ratingScale: Int? = null,
    val optionIds: List<String>? = null,
    val maxSelections: Int? = null,
    val label: String? = null,
    val labelSource: AnalysisLabelSource = AnalysisLabelSource.UNKNOWN,
    val flowDependencies: List<AnalysisFlowDependencyV1> = emptyList(),
)

@Serializable
data class AnalysisCatalogSourceV1(
    val app: String,
    val surveyId: String,
    val surveyType: SurveyType? = null,
    val archived: Boolean,
    val definitionHash: String? = null,
    val definitionStatus: AnalysisDefinitionStatus,
    val observedDefinitionHashes: List<String?>,
    /**
     * Latest observed, validated flow hash. This is an independent catalog
     * summary and must not be paired with [definitionHash], which is the
     * currently registered definition. Exact pairs are kept in
     * [contractRevisions] for publication compilation.
     */
    val flowHash: String? = null,
    val flowHashes: List<String> = emptyList(),
    val observedFlowHashes: List<String?> = emptyList(),
    val flowStatus: AnalysisFlowStatus,
    val fields: List<AnalysisCatalogFieldV1>,
    val warnings: List<AnalysisCatalogWarning>,
    @Transient
    internal val contractRevisions: List<AnalysisCatalogContractRevision> = emptyList(),
)

/**
 * Trusted compiler input assembled from immutable source contracts.
 *
 * This is deliberately excluded from the serialized team catalog: the UI only
 * needs the safe aggregate catalog, while publication compilation needs the
 * exact definition-flow pairing and historical field structure.
 */
data class AnalysisCatalogContractRevision(
    val definitionHash: String,
    val flowHash: String,
    val surveyType: SurveyType,
    val fields: List<AnalysisCatalogFieldV1>,
    val evaluatorVersion: String,
    val dependenciesByField: List<AnalysisFieldDependenciesV1>,
)

@Serializable
data class AnalysisFieldDependenciesV1(
    val fieldId: String,
    val dependencies: List<AnalysisFlowDependencyV1>,
)

@Serializable
enum class AnalysisDimensionDataClass {
    TECHNICAL_CONTEXT,
}

@Serializable
enum class AnalysisDimensionNewValuePolicy {
    BLOCK,
}

@Serializable
data class AnalysisDimensionDefinitionV1(
    val key: String,
    val outputId: String,
    val type: AnalysisColumnType,
    val owner: String,
    val description: String,
    val dataClass: AnalysisDimensionDataClass,
    val maxCardinality: Int,
    val allowedValues: List<String>,
    val newValuePolicy: AnalysisDimensionNewValuePolicy,
    val defaultSelected: Boolean,
)

@Serializable
data class AnalysisDimensionRegistrySnapshotV1(
    val schemaVersion: Int = 1,
    val revision: String,
    val dimensions: List<AnalysisDimensionDefinitionV1>,
)

@Serializable
data class AnalysisSourceCatalogV1(
    val schemaVersion: Int = ANALYSIS_SOURCE_CATALOG_SCHEMA_VERSION,
    val team: String,
    val catalogRevision: String,
    val sources: List<AnalysisCatalogSourceV1>,
    val dimensions: List<AnalysisDimensionDefinitionV1>,
)

object AnalysisDimensionRegistry {
    private val definitions = listOf(
        AnalysisDimensionDefinitionV1(
            key = "deviceType",
            outputId = "device_type",
            type = AnalysisColumnType.STRING,
            owner = "Lumi",
            description = "Lukket enhetstype rapportert av Lumi-klienten.",
            dataClass = AnalysisDimensionDataClass.TECHNICAL_CONTEXT,
            maxCardinality = 3,
            allowedValues = listOf("desktop", "mobile", "tablet"),
            newValuePolicy = AnalysisDimensionNewValuePolicy.BLOCK,
            defaultSelected = false,
        ),
    )

    fun snapshot(): AnalysisDimensionRegistrySnapshotV1 {
        val sorted = definitions.sortedBy { it.key }
        return AnalysisDimensionRegistrySnapshotV1(
            revision = AnalysisCanonicalHash.digest(
                "analysis-dimension-registry-v1",
                sorted.flatMap { dimension ->
                    listOf(
                        dimension.key,
                        dimension.outputId,
                        dimension.type.name,
                        dimension.owner,
                        dimension.description,
                        dimension.dataClass.name,
                        dimension.maxCardinality.toString(),
                        dimension.allowedValues.sorted().joinToString(","),
                        dimension.newValuePolicy.name,
                        dimension.defaultSelected.toString(),
                    )
                },
            ),
            dimensions = sorted,
        )
    }
}

object AnalysisCatalogRevision {
    fun compute(
        team: String,
        sources: List<AnalysisCatalogSourceV1>,
        dimensions: AnalysisDimensionRegistrySnapshotV1,
    ): String {
        val facts = buildList {
            add(team)
            add(dimensions.revision)
            sources.sortedWith(compareBy(AnalysisCatalogSourceV1::app, AnalysisCatalogSourceV1::surveyId))
                .forEach { source ->
                    addSourceFacts(source, source.fields.map { it.fieldId })
                }
        }
        return "catalog-v1:${AnalysisCanonicalHash.digest("analysis-source-catalog-v1", facts)}"
    }

    fun computeForSelection(
        team: String,
        selections: List<AnalysisProductSourceSelection>,
        sources: List<AnalysisCatalogSourceV1>,
        dimensionKeys: List<String>,
        dimensions: AnalysisDimensionRegistrySnapshotV1,
    ): String {
        val sourcesByKey = sources.associateBy { it.app to it.surveyId }
        val dimensionsByKey = dimensions.dimensions.associateBy { it.key }
        val facts = buildList {
            add(team)
            selections.sortedWith(compareBy(AnalysisProductSourceSelection::app, AnalysisProductSourceSelection::surveyId))
                .forEach { selection ->
                    val source = sourcesByKey[selection.app to selection.surveyId]
                    if (source == null) {
                        add(selection.app)
                        add(selection.surveyId)
                        add("<missing-source>")
                        selection.fieldIds.sorted().forEach { fieldId ->
                            add(fieldId)
                            add("<missing-field>")
                        }
                    } else {
                        addSourceFacts(source, selection.fieldIds)
                    }
                }
            dimensionKeys.sorted().forEach { key ->
                add(key)
                val dimension = dimensionsByKey[key]
                if (dimension == null) {
                    add("<missing-dimension>")
                } else {
                    addDimensionFacts(dimension)
                }
            }
        }
        return "selection-v1:${AnalysisCanonicalHash.digest("analysis-source-selection-v1", facts)}"
    }

    private fun MutableList<String>.addSourceFacts(
        source: AnalysisCatalogSourceV1,
        selectedFieldIds: List<String>,
    ) {
        add(source.app)
        add(source.surveyId)
        add(source.surveyType?.name ?: "<null>")
        add(source.definitionHash ?: "<null>")
        add(source.definitionStatus.name)
        add(source.flowHash ?: "<null>")
        source.flowHashes.sorted().forEach(::add)
        source.observedFlowHashes
            .map { it ?: "<null>" }
            .sorted()
            .forEach(::add)
        add(source.flowStatus.name)
        source.observedDefinitionHashes
            .map { it ?: "<null>" }
            .sorted()
            .forEach(::add)
        source.warnings.map(Enum<*>::name).sorted().forEach(::add)
        source.contractRevisions
            .sortedWith(compareBy(AnalysisCatalogContractRevision::definitionHash, AnalysisCatalogContractRevision::flowHash))
            .forEach { revision ->
                add(revision.definitionHash)
                add(revision.flowHash)
                add(revision.surveyType.name)
                add(revision.evaluatorVersion)
                revision.fields
                    .filter { it.fieldId in selectedFieldIds }
                    .sortedBy { it.fieldId }
                    .forEach { field -> addFieldFacts(field) }
                revision.dependenciesByField
                    .filter { it.fieldId in selectedFieldIds }
                    .sortedBy { it.fieldId }
                    .forEach { fieldDependencies ->
                        add(fieldDependencies.fieldId)
                        fieldDependencies.dependencies
                            .sortedWith(compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key))
                            .forEach { dependency ->
                                add(dependency.source.name)
                                add(dependency.key)
                            }
                    }
            }

        val fieldsById = source.fields.associateBy { it.fieldId }
        selectedFieldIds.sorted().forEach { fieldId ->
            val field = fieldsById[fieldId]
            if (field == null) {
                add(fieldId)
                add("<missing-field>")
            } else {
                addFieldFacts(field)
            }
        }
    }

    private fun MutableList<String>.addFieldFacts(field: AnalysisCatalogFieldV1) {
        add(field.fieldId)
        add(field.fieldType.name)
        add(field.ratingVariant?.name ?: "<null>")
        add(field.ratingScale?.toString() ?: "<null>")
        add(field.maxSelections?.toString() ?: "<null>")
        field.optionIds.orEmpty().forEach(::add)
        add(field.labelSource.name)
        if (field.labelSource != AnalysisLabelSource.UNKNOWN) {
            add(field.label ?: "<null>")
        }
        field.flowDependencies
            .sortedWith(compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key))
            .forEach { dependency ->
                add(dependency.source.name)
                add(dependency.key)
            }
    }

    private fun MutableList<String>.addDimensionFacts(dimension: AnalysisDimensionDefinitionV1) {
        add(dimension.outputId)
        add(dimension.type.name)
        add(dimension.owner)
        add(dimension.description)
        add(dimension.dataClass.name)
        add(dimension.maxCardinality.toString())
        dimension.allowedValues.forEach(::add)
        add(dimension.newValuePolicy.name)
        add(dimension.defaultSelected.toString())
    }
}

internal object AnalysisCanonicalHash {
    fun digest(domain: String, parts: Iterable<String>): String {
        val canonical = buildString {
            appendLengthPrefixed(domain)
            parts.forEach { part -> appendLengthPrefixed(part) }
        }
        return MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun StringBuilder.appendLengthPrefixed(value: String) {
        append(value.toByteArray(Charsets.UTF_8).size)
        append(':')
        append(value)
    }
}
