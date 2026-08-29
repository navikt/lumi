package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.Locale

const val ANALYSIS_CONTRACT_COMPILER_VERSION = "analysis-contract-compiler-v1"
const val ANALYSIS_CONTRACT_VERSION = "v1"
const val ANALYSIS_PREVIEW_PRIVACY_POLICY_VERSION = "synthetic-only-v1"
private val SHA256_PATTERN = Regex("^[0-9a-f]{64}$")
private val SYNTHETIC_FLOW_HASH = AnalysisCanonicalHash.digest("analysis-synthetic-flow-v1", emptyList())

val AnalysisContractJson = Json {
    encodeDefaults = true
    explicitNulls = true
}

@Serializable
enum class AnalysisColumnType {
    STRING,
    INT64,
    BOOL,
    FLOAT64,
    DATE,
    TIMESTAMP,
}

@Serializable
enum class AnalysisResourceKind {
    WIDE,
    LONG,
    FIELD_CATALOG,
    MANIFEST,
}

@Serializable
data class AnalysisColumnV1(
    val logicalId: String,
    val name: String,
    val type: AnalysisColumnType,
    val nullable: Boolean,
    val description: String,
)

@Serializable
data class AnalysisResourceSchemaV1(
    val name: String,
    val kind: AnalysisResourceKind,
    val rowMeaning: String,
    val sourceApp: String? = null,
    val sourceSurveyId: String? = null,
    val columns: List<AnalysisColumnV1>,
    val syntheticRows: List<JsonObject> = emptyList(),
)

@Serializable
enum class PreviewDataOrigin {
    SYNTHETIC,
}

@Serializable
enum class AnalysisContractPreviewStatus {
    READY,
    READY_WITH_WARNINGS,
    BLOCKED,
}

@Serializable
enum class AnalysisCompilationIssueSeverity {
    WARNING,
    BLOCKER,
}

@Serializable
enum class AnalysisCompilationIssueCode {
    TEAM_SCOPE_MISMATCH,
    SOURCE_UNAVAILABLE,
    SOURCE_ID_MISMATCH,
    DEFINITION_NOT_REGISTERED,
    DEFINITION_HASH_UNRESOLVED,
    LEGACY_DEFINITION_OBSERVED,
    FLOW_NOT_PINNED,
    UNPINNED_FLOW_HISTORY_EXCLUDED,
    FLOW_DEPENDENCY_NOT_SELECTED,
    FIELD_UNAVAILABLE,
    FIELD_NOT_ALLOWED,
    FIELD_MALFORMED,
    DIMENSION_UNAVAILABLE,
    WIDE_COLUMN_BUDGET_WARNING,
    WIDE_COLUMN_BUDGET_EXCEEDED,
    PHYSICAL_NAME_COLLISION,
}

@Serializable
data class AnalysisCompilationIssue(
    val severity: AnalysisCompilationIssueSeverity,
    val code: AnalysisCompilationIssueCode,
    val sourceApp: String? = null,
    val sourceSurveyId: String? = null,
    val fieldId: String? = null,
    val dimensionKey: String? = null,
)

@Serializable
data class AnalysisSourcePinV1(
    val app: String,
    val surveyId: String,
    val surveyType: SurveyType,
    val definitionHash: String,
    val flowHash: String,
    val allowedFlowHashes: List<String> = listOf(flowHash),
    val fields: List<AnalysisFieldPinV1>,
)

@Serializable
data class AnalysisFieldPinV1(
    val fieldId: String,
    val fieldType: FieldType,
    val ratingVariant: RatingVariant? = null,
    val ratingScale: Int? = null,
    val optionIds: List<String> = emptyList(),
    val maxSelections: Int? = null,
    val label: String? = null,
    val labelSource: AnalysisLabelSource,
    val flowDependencies: List<AnalysisFlowDependencyV1> = emptyList(),
)

@Serializable
data class AnalysisPublicationSpecificationV1(
    val schemaVersion: Int = 1,
    val compilerVersion: String = ANALYSIS_CONTRACT_COMPILER_VERSION,
    val canonicalizationVersion: String = "length-prefixed-v1",
    val contractVersion: String = ANALYSIS_CONTRACT_VERSION,
    val productId: String,
    val team: String,
    val retention: AnalysisProductRetention,
    val catalogRevision: String,
    val sourcePins: List<AnalysisSourcePinV1>,
    val dimensions: List<AnalysisDimensionDefinitionV1>,
    val resources: List<AnalysisResourceSchemaV1>,
    val excludedDataCategories: List<String>,
    val baseSchemaDigest: String,
)

@Serializable
data class AnalysisProductContractPreviewV1(
    val schemaVersion: Int = 1,
    val compilerVersion: String = ANALYSIS_CONTRACT_COMPILER_VERSION,
    val contractVersion: String = ANALYSIS_CONTRACT_VERSION,
    val privacyPolicyVersion: String = ANALYSIS_PREVIEW_PRIVACY_POLICY_VERSION,
    val dataOrigin: PreviewDataOrigin = PreviewDataOrigin.SYNTHETIC,
    val productId: String,
    val draftId: String,
    val draftRevision: Long,
    val documentHash: String,
    val catalogRevision: String,
    val baseSchemaDigest: String,
    val publicationSpecificationDigest: String? = null,
    val status: AnalysisContractPreviewStatus,
    val resources: List<AnalysisResourceSchemaV1>,
    val issues: List<AnalysisCompilationIssue>,
    val excludedDataCategories: List<String>,
    val aggregatePreviewAvailable: Boolean = false,
    val publicationSpecification: AnalysisPublicationSpecificationV1? = null,
)

data class AnalysisProductCompilationInput(
    val productId: String,
    val team: String,
    val draftId: String,
    val draftRevision: Long,
    val documentHash: String,
    val document: AnalysisProductDocumentV1,
    val catalog: AnalysisSourceCatalogV1,
    val dimensions: AnalysisDimensionRegistrySnapshotV1,
)

class AnalysisContractCompiler {
    fun compilePreview(input: AnalysisProductCompilationInput): AnalysisProductContractPreviewV1 {
        val issues = mutableListOf<AnalysisCompilationIssue>()
        if (input.catalog.team != input.team) {
            issues += issue(AnalysisCompilationIssueCode.TEAM_SCOPE_MISMATCH)
        }

        val catalogSources = input.catalog.sources.associateBy { it.app to it.surveyId }
        val dimensions = input.dimensions.dimensions.associateBy { it.key }
        val selectedDimensions = input.document.dimensionKeys.sorted().mapNotNull { key ->
            dimensions[key] ?: run {
                issues += issue(AnalysisCompilationIssueCode.DIMENSION_UNAVAILABLE, dimensionKey = key)
                null
            }
        }
        val selectionCatalogRevision = AnalysisCatalogRevision.computeForSelection(
            team = input.team,
            selections = input.document.sources,
            sources = input.catalog.sources,
            dimensionKeys = input.document.dimensionKeys,
            dimensions = input.dimensions,
        )

        val resolvedSources = input.document.sources
            .sortedWith(compareBy(AnalysisProductSourceSelection::app, AnalysisProductSourceSelection::surveyId))
            .mapNotNull { selection ->
                val source = catalogSources[selection.app to selection.surveyId]
                if (source == null || input.catalog.team != input.team) {
                    issues += issue(
                        AnalysisCompilationIssueCode.SOURCE_UNAVAILABLE,
                        app = selection.app,
                        surveyId = selection.surveyId,
                    )
                    return@mapNotNull null
                }
                validateSource(source, selection, input.document.dimensionKeys, issues)
                ResolvedAnalysisSource(
                    source = source,
                    selectedFields = selection.fieldIds.sorted().mapNotNull { fieldId ->
                        val field = source.fields.singleOrNull { it.fieldId == fieldId }
                        if (field == null) {
                            issues += issue(
                                AnalysisCompilationIssueCode.FIELD_UNAVAILABLE,
                                app = source.app,
                                surveyId = source.surveyId,
                                fieldId = fieldId,
                            )
                            null
                        } else if (field.fieldType in setOf(FieldType.TEXT, FieldType.DATE)) {
                            issues += issue(
                                AnalysisCompilationIssueCode.FIELD_NOT_ALLOWED,
                                app = source.app,
                                surveyId = source.surveyId,
                                fieldId = fieldId,
                            )
                            null
                        } else if (!field.isWellFormed()) {
                            issues += issue(
                                AnalysisCompilationIssueCode.FIELD_MALFORMED,
                                app = source.app,
                                surveyId = source.surveyId,
                                fieldId = fieldId,
                            )
                            null
                        } else {
                            field
                        }
                    },
                )
            }

        val resources = buildResources(
            productId = input.productId,
            team = input.team,
            sources = resolvedSources,
            dimensions = selectedDimensions,
            includeSubmittedHour = input.document.includeSubmittedHour,
            issues = issues,
        )
        val sortedIssues = issues.distinct().sortedWith(
            compareBy<AnalysisCompilationIssue>(
                { it.severity.name },
                { it.code.name },
                { it.sourceApp.orEmpty() },
                { it.sourceSurveyId.orEmpty() },
                { it.fieldId.orEmpty() },
                { it.dimensionKey.orEmpty() },
            ),
        )
        val baseSchemaDigest = digestResources(resources)
        val exclusions = listOf(
            "CLIENT_LABELS",
            "CONTEXT_TAGS",
            "DATE_ANSWERS",
            "DEBUG",
            "DEDUPLICATION_HASH",
            "INTERNAL_FEEDBACK_ID",
            "RAW_JSON",
            "TEXT_ANSWERS",
            "URL_AND_PATH",
            "USER_AGENT_AND_VIEWPORT",
        )
        val hasBlockers = sortedIssues.any { it.severity == AnalysisCompilationIssueSeverity.BLOCKER }
        val bareResources = resources.map { it.copy(syntheticRows = emptyList()) }
        val specification = if (hasBlockers) {
            null
        } else {
            AnalysisPublicationSpecificationV1(
                productId = input.productId,
                team = input.team,
                retention = input.document.retention,
                catalogRevision = selectionCatalogRevision,
                sourcePins = resolvedSources.map { resolved ->
                    AnalysisSourcePinV1(
                        app = resolved.source.app,
                        surveyId = resolved.source.surveyId,
                        surveyType = requireNotNull(resolved.source.surveyType),
                        definitionHash = requireNotNull(resolved.source.definitionHash),
                        flowHash = requireNotNull(resolved.source.flowHash),
                        allowedFlowHashes = resolved.source.flowHashes.sorted().ifEmpty {
                            listOf(requireNotNull(resolved.source.flowHash))
                        },
                        fields = resolved.selectedFields.map { field ->
                            AnalysisFieldPinV1(
                                fieldId = field.fieldId,
                                fieldType = field.fieldType,
                                ratingVariant = field.ratingVariant,
                                ratingScale = field.ratingScale,
                                optionIds = field.optionIds.orEmpty(),
                                maxSelections = field.maxSelections,
                                label = field.label.takeIf { field.labelSource != AnalysisLabelSource.UNKNOWN },
                                labelSource = field.labelSource,
                                flowDependencies = field.flowDependencies,
                            )
                        },
                    )
                },
                dimensions = selectedDimensions,
                resources = bareResources,
                excludedDataCategories = exclusions,
                baseSchemaDigest = baseSchemaDigest,
            )
        }
        val specificationDigest = specification?.let(::digestSpecification)

        return AnalysisProductContractPreviewV1(
            productId = input.productId,
            draftId = input.draftId,
            draftRevision = input.draftRevision,
            documentHash = input.documentHash,
            catalogRevision = selectionCatalogRevision,
            baseSchemaDigest = baseSchemaDigest,
            publicationSpecificationDigest = specificationDigest,
            status = when {
                hasBlockers -> AnalysisContractPreviewStatus.BLOCKED
                sortedIssues.isNotEmpty() -> AnalysisContractPreviewStatus.READY_WITH_WARNINGS
                else -> AnalysisContractPreviewStatus.READY
            },
            resources = resources,
            issues = sortedIssues,
            excludedDataCategories = exclusions,
            publicationSpecification = specification,
        )
    }

    private fun validateSource(
        source: AnalysisCatalogSourceV1,
        selection: AnalysisProductSourceSelection,
        selectedDimensionKeys: List<String>,
        issues: MutableList<AnalysisCompilationIssue>,
    ) {
        if (source.definitionStatus != AnalysisDefinitionStatus.REGISTERED || source.surveyType == null) {
            issues += issue(
                AnalysisCompilationIssueCode.DEFINITION_NOT_REGISTERED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (source.definitionHash?.matches(SHA256_PATTERN) != true) {
            issues += issue(
                AnalysisCompilationIssueCode.DEFINITION_HASH_UNRESOLVED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (source.definitionHash != null && source.observedDefinitionHashes.any { it != null && it != source.definitionHash }) {
            issues += issue(
                AnalysisCompilationIssueCode.DEFINITION_HASH_UNRESOLVED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (AnalysisCatalogWarning.DEFINITION_CONTENT_MISMATCH in source.warnings) {
            issues += issue(
                AnalysisCompilationIssueCode.DEFINITION_HASH_UNRESOLVED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (source.observedDefinitionHashes.any { it == null }) {
            issues += issue(
                AnalysisCompilationIssueCode.LEGACY_DEFINITION_OBSERVED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (source.flowStatus != AnalysisFlowStatus.PINNED || source.flowHash?.matches(SHA256_PATTERN) != true) {
            issues += issue(
                AnalysisCompilationIssueCode.FLOW_NOT_PINNED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (
            source.flowHashes.any { !it.matches(SHA256_PATTERN) } ||
            (source.flowHashes.isNotEmpty() && source.flowHash !in source.flowHashes)
        ) {
            issues += issue(
                AnalysisCompilationIssueCode.FLOW_NOT_PINNED,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (
            source.flowStatus == AnalysisFlowStatus.PINNED &&
            AnalysisCatalogWarning.LEGACY_FLOW_OBSERVED in source.warnings
        ) {
            issues += issue(
                AnalysisCompilationIssueCode.UNPINNED_FLOW_HISTORY_EXCLUDED,
                severity = AnalysisCompilationIssueSeverity.WARNING,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        if (AnalysisCatalogWarning.SOURCE_ID_MISMATCH in source.warnings) {
            issues += issue(
                AnalysisCompilationIssueCode.SOURCE_ID_MISMATCH,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
        source.fields
            .filter { it.fieldId in selection.fieldIds }
            .flatMap { field -> field.flowDependencies.map { dependency -> field.fieldId to dependency } }
            .forEach { (fieldId, dependency) ->
                val selected = when (dependency.source) {
                    AnalysisFlowDependencySource.ANSWER -> dependency.key in selection.fieldIds
                    AnalysisFlowDependencySource.METADATA -> dependency.key in selectedDimensionKeys
                }
                if (!selected) {
                    issues += issue(
                        AnalysisCompilationIssueCode.FLOW_DEPENDENCY_NOT_SELECTED,
                        app = source.app,
                        surveyId = source.surveyId,
                        fieldId = fieldId,
                        dimensionKey = dependency.key.takeIf {
                            dependency.source == AnalysisFlowDependencySource.METADATA
                        },
                    )
                }
            }
        if (selection.fieldIds.isEmpty()) {
            // An empty source is allowed in a draft and produces a population-only
            // wide schema. The UI may use this while fields are being selected.
            return
        }
    }

    private fun buildResources(
        productId: String,
        team: String,
        sources: List<ResolvedAnalysisSource>,
        dimensions: List<AnalysisDimensionDefinitionV1>,
        includeSubmittedHour: Boolean,
        issues: MutableList<AnalysisCompilationIssue>,
    ): List<AnalysisResourceSchemaV1> {
        val wide = sources.map { resolved ->
            val dynamicColumns = buildDynamicColumns(resolved.selectedFields, dimensions)
            val budget = dynamicColumns.size
            if (budget >= 80) {
                issues += issue(
                    AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_WARNING,
                    severity = AnalysisCompilationIssueSeverity.WARNING,
                    app = resolved.source.app,
                    surveyId = resolved.source.surveyId,
                )
            }
            if (budget > 120) {
                issues += issue(
                    AnalysisCompilationIssueCode.WIDE_COLUMN_BUDGET_EXCEEDED,
                    app = resolved.source.app,
                    surveyId = resolved.source.surveyId,
                )
            }
            val columns = commonColumns(includeSubmittedHour) + dynamicColumns
            ensureUniqueColumns(columns, resolved.source, issues)
            AnalysisResourceSchemaV1(
                name = AnalysisPhysicalNames.resourceName(resolved.source.app, resolved.source.surveyId),
                kind = AnalysisResourceKind.WIDE,
                rowMeaning = "One synthetic row represents one submission for this app and survey.",
                sourceApp = resolved.source.app,
                sourceSurveyId = resolved.source.surveyId,
                columns = columns,
                syntheticRows = listOf(
                    syntheticWideRow(productId, team, resolved, dimensions, columns),
                ),
            )
        }

        val longColumns = longColumns(includeSubmittedHour, dimensions)
        val catalogColumns = fieldCatalogColumns()
        val manifestColumns = manifestColumns()
        val longResource = AnalysisResourceSchemaV1(
            name = "answers_long_v1",
            kind = AnalysisResourceKind.LONG,
            rowMeaning = "One synthetic row represents one structured answer value atom.",
            columns = longColumns,
            syntheticRows = sources.firstNotNullOfOrNull { resolved ->
                resolved.selectedFields.firstOrNull()?.let { field ->
                    syntheticLongRow(productId, team, resolved, field, dimensions, longColumns)
                }
            }?.let(::listOf).orEmpty(),
        )
        val catalogResource = AnalysisResourceSchemaV1(
            name = "field_catalog_v1",
            kind = AnalysisResourceKind.FIELD_CATALOG,
            rowMeaning = "One synthetic row represents a field or option metadata entry.",
            columns = catalogColumns,
            syntheticRows = sources.firstNotNullOfOrNull { resolved ->
                resolved.selectedFields.firstOrNull()?.let { field ->
                    syntheticCatalogRows(productId, team, resolved, field, catalogColumns)
                }
            }.orEmpty(),
        )
        val publicResources = wide + longResource + catalogResource
        val manifestResource = AnalysisResourceSchemaV1(
            name = "product_manifest_v1",
            kind = AnalysisResourceKind.MANIFEST,
            rowMeaning = "One synthetic row represents one public analytic resource, excluding the manifest itself.",
            columns = manifestColumns,
            syntheticRows = publicResources.firstOrNull()?.let { resource ->
                listOf(syntheticManifestRow(productId, resource.name, resource.kind, manifestColumns))
            }.orEmpty(),
        )
        return publicResources + manifestResource
    }

    private fun buildDynamicColumns(
        fields: List<AnalysisCatalogFieldV1>,
        dimensions: List<AnalysisDimensionDefinitionV1>,
    ): List<AnalysisColumnV1> = buildList {
        fields.sortedBy { it.fieldId }.forEach { field ->
            add(
                column(
                    logicalId = "field:${field.fieldId}:applicable",
                    name = AnalysisPhysicalNames.fieldColumn(field.fieldId, "applicable"),
                    type = AnalysisColumnType.BOOL,
                    nullable = true,
                    description = "Whether structured field '${field.fieldId}' was applicable.",
                ),
            )
            when (field.fieldType) {
                FieldType.RATING -> add(
                    column(
                        "field:${field.fieldId}:rating",
                        AnalysisPhysicalNames.fieldColumn(field.fieldId, "rating"),
                        AnalysisColumnType.INT64,
                        true,
                        "Rating value for structured field '${field.fieldId}'.",
                    ),
                )

                FieldType.SINGLE_CHOICE -> add(
                    column(
                        "field:${field.fieldId}:option_id",
                        AnalysisPhysicalNames.fieldColumn(field.fieldId, "option_id"),
                        AnalysisColumnType.STRING,
                        true,
                        "Selected option ID for structured field '${field.fieldId}'.",
                    ),
                )

                FieldType.MULTI_CHOICE -> {
                    add(
                        column(
                            "field:${field.fieldId}:selection_count",
                            AnalysisPhysicalNames.fieldColumn(field.fieldId, "selection_count"),
                            AnalysisColumnType.INT64,
                            true,
                            "Distinct selected option count for structured field '${field.fieldId}'.",
                        ),
                    )
                    field.optionIds.orEmpty().sorted().forEach { optionId ->
                        add(
                            column(
                                "field:${field.fieldId}:option:$optionId:selected",
                                AnalysisPhysicalNames.optionColumn(field.fieldId, optionId),
                                AnalysisColumnType.BOOL,
                                true,
                                "Whether option '$optionId' was selected for structured field '${field.fieldId}'.",
                            ),
                        )
                    }
                }

                FieldType.TEXT, FieldType.DATE -> Unit
            }
        }
        dimensions.sortedBy { it.key }.forEach { dimension ->
            add(
                column(
                    "dimension:${dimension.key}",
                    AnalysisPhysicalNames.dimensionColumn(dimension),
                    dimension.type,
                    true,
                    dimension.description,
                ),
            )
        }
    }

    private fun ensureUniqueColumns(
        columns: List<AnalysisColumnV1>,
        source: AnalysisCatalogSourceV1,
        issues: MutableList<AnalysisCompilationIssue>,
    ) {
        if (columns.map { it.name }.distinct().size != columns.size) {
            issues += issue(
                AnalysisCompilationIssueCode.PHYSICAL_NAME_COLLISION,
                app = source.app,
                surveyId = source.surveyId,
            )
        }
    }

    private fun digestResources(resources: List<AnalysisResourceSchemaV1>): String = AnalysisCanonicalHash.digest(
        "analysis-public-schema-v1",
        resources.sortedBy { it.name }.flatMap { resource ->
            buildList {
                add(resource.name)
                add(resource.kind.name)
                add(resource.rowMeaning)
                add(resource.sourceApp ?: "<null>")
                add(resource.sourceSurveyId ?: "<null>")
                resource.columns.forEach { column ->
                    add(column.logicalId)
                    add(column.name)
                    add(column.type.name)
                    add(column.nullable.toString())
                    add(column.description)
                }
            }
        },
    )

    private fun digestSpecification(specification: AnalysisPublicationSpecificationV1): String =
        AnalysisCanonicalHash.digest(
            "analysis-publication-specification-v1",
            buildList {
                add(specification.schemaVersion.toString())
                add(specification.compilerVersion)
                add(specification.canonicalizationVersion)
                add(specification.contractVersion)
                add(specification.productId)
                add(specification.team)
                add(specification.retention.name)
                add(specification.catalogRevision)
                specification.sourcePins.forEach { pin ->
                    add(pin.app)
                    add(pin.surveyId)
                    add(pin.surveyType.name)
                    add(pin.definitionHash)
                    add(pin.flowHash)
                    pin.allowedFlowHashes.sorted().forEach(::add)
                    pin.fields.forEach { field ->
                        add(field.fieldId)
                        add(field.fieldType.name)
                        add(field.ratingVariant?.name ?: "<null>")
                        add(field.ratingScale?.toString() ?: "<null>")
                        field.optionIds.forEach(::add)
                        add(field.maxSelections?.toString() ?: "<null>")
                        add(field.label ?: "<null>")
                        add(field.labelSource.name)
                        field.flowDependencies
                            .sortedWith(compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key))
                            .forEach { dependency ->
                                add(dependency.source.name)
                                add(dependency.key)
                            }
                    }
                }
                specification.dimensions.forEach { dimension ->
                    add(dimension.key)
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
                add(specification.baseSchemaDigest)
                specification.excludedDataCategories.sorted().forEach(::add)
            },
        )

}

private data class ResolvedAnalysisSource(
    val source: AnalysisCatalogSourceV1,
    val selectedFields: List<AnalysisCatalogFieldV1>,
)

object AnalysisPhysicalNames {
    fun resourceName(app: String, surveyId: String): String {
        val identity = listOf(app, surveyId)
        val hash = AnalysisCanonicalHash.digest("analysis-wide-resource-name-v1", identity).take(24)
        val appSlug = slug(app, 32)
        val surveySlug = slug(surveyId, 32)
        return "responses_${appSlug}_${surveySlug}_${hash}_wide_v1".take(128)
    }

    fun fieldColumn(fieldId: String, suffix: String): String =
        "field_${slug(fieldId, 32)}_${AnalysisCanonicalHash.digest("analysis-field-column-v1", listOf(fieldId)).take(24)}__$suffix"

    fun optionColumn(fieldId: String, optionId: String): String =
        "field_${slug(fieldId, 20)}_${AnalysisCanonicalHash.digest("analysis-field-option-prefix-v1", listOf(fieldId)).take(24)}" +
            "__option_${slug(optionId, 20)}_${AnalysisCanonicalHash.digest("analysis-option-column-v1", listOf(fieldId, optionId)).take(24)}__selected"

    fun dimensionColumn(dimension: AnalysisDimensionDefinitionV1): String =
        "dim_${slug(dimension.outputId, 48)}_" +
            AnalysisCanonicalHash.digest("analysis-dimension-column-v1", listOf(dimension.key, dimension.outputId)).take(24)

    private fun slug(value: String, maxLength: Int): String {
        val lowered = value.lowercase(Locale.ROOT)
        val normalized = buildString {
            lowered.forEach { char ->
                append(if (char in 'a'..'z' || char in '0'..'9') char else '_')
            }
        }.replace(Regex("_+"), "_").trim('_').ifEmpty { "x" }
        val prefixed = if (normalized.first().isDigit()) "x_$normalized" else normalized
        return prefixed.take(maxLength).trimEnd('_').ifEmpty { "x" }
    }
}

private fun AnalysisCatalogFieldV1.isWellFormed(): Boolean = when (fieldType) {
    FieldType.RATING ->
        ratingVariant != null &&
            ratingScale == RatingVariant.getScale(ratingVariant) &&
            optionIds == null &&
            maxSelections == null

    FieldType.SINGLE_CHOICE ->
        ratingVariant == null &&
            ratingScale == null &&
            maxSelections == null &&
            !optionIds.isNullOrEmpty() &&
            optionIds.distinct().size == optionIds.size

    FieldType.MULTI_CHOICE ->
        ratingVariant == null &&
            ratingScale == null &&
            !optionIds.isNullOrEmpty() &&
            optionIds.distinct().size == optionIds.size &&
            (maxSelections == null || maxSelections in 1..optionIds.size)

    FieldType.TEXT, FieldType.DATE -> true
}

private fun issue(
    code: AnalysisCompilationIssueCode,
    severity: AnalysisCompilationIssueSeverity = AnalysisCompilationIssueSeverity.BLOCKER,
    app: String? = null,
    surveyId: String? = null,
    fieldId: String? = null,
    dimensionKey: String? = null,
) = AnalysisCompilationIssue(severity, code, app, surveyId, fieldId, dimensionKey)

private fun column(
    logicalId: String,
    name: String,
    type: AnalysisColumnType,
    nullable: Boolean,
    description: String,
) = AnalysisColumnV1(logicalId, name, type, nullable, description)

private fun commonColumns(includeSubmittedHour: Boolean): List<AnalysisColumnV1> = buildList {
    add(column("response_key", "response_key", AnalysisColumnType.STRING, false, "Product-scoped stable response key."))
    add(column("product_id", "product_id", AnalysisColumnType.STRING, false, "Analysis product ID."))
    add(column("product_release", "product_release", AnalysisColumnType.INT64, false, "Immutable product release number."))
    add(column("product_snapshot_id", "product_snapshot_id", AnalysisColumnType.STRING, false, "Atomic product snapshot ID."))
    add(column("team_slug", "team_slug", AnalysisColumnType.STRING, false, "Owning team slug."))
    add(column("app", "app", AnalysisColumnType.STRING, false, "Source application."))
    add(column("survey_id", "survey_id", AnalysisColumnType.STRING, false, "Source survey ID."))
    add(column("survey_type", "survey_type", AnalysisColumnType.STRING, false, "Survey type."))
    add(column("submitted_date", "submitted_date", AnalysisColumnType.DATE, false, "Server storage date in Europe/Oslo."))
    if (includeSubmittedHour) {
        add(column("submitted_hour", "submitted_hour", AnalysisColumnType.TIMESTAMP, true, "Server storage time truncated to UTC hour."))
    }
    add(column("definition_hash", "definition_hash", AnalysisColumnType.STRING, true, "Ingest-matched structural definition hash."))
    add(column("definition_status", "definition_status", AnalysisColumnType.STRING, false, "REGISTERED or LEGACY_DERIVED."))
    add(column("flow_hash", "flow_hash", AnalysisColumnType.STRING, true, "Ingest-matched flow hash."))
    add(column("flow_status", "flow_status", AnalysisColumnType.STRING, false, "PINNED or UNPINNED."))
}

private fun longColumns(
    includeSubmittedHour: Boolean,
    dimensions: List<AnalysisDimensionDefinitionV1>,
): List<AnalysisColumnV1> = buildList {
    addAll(commonColumns(includeSubmittedHour).let { columns ->
        val answerKey = column("answer_key", "answer_key", AnalysisColumnType.STRING, false, "Stable logical answer key.")
        listOf(columns.first(), answerKey) + columns.drop(1)
    })
    add(column("field_id", "field_id", AnalysisColumnType.STRING, false, "Stable structured field ID."))
    add(column("field_type", "field_type", AnalysisColumnType.STRING, false, "RATING, SINGLE_CHOICE or MULTI_CHOICE."))
    add(column("field_metadata_hash", "field_metadata_hash", AnalysisColumnType.STRING, false, "Approved or UNKNOWN field metadata hash."))
    add(column("value_kind", "value_kind", AnalysisColumnType.STRING, false, "RATING, OPTION or EMPTY_SELECTION."))
    add(column("rating_value", "rating_value", AnalysisColumnType.INT64, true, "Rating value."))
    add(column("option_id", "option_id", AnalysisColumnType.STRING, true, "Selected stable option ID."))
    add(column("option_metadata_hash", "option_metadata_hash", AnalysisColumnType.STRING, true, "Approved or UNKNOWN option metadata hash."))
    add(column("selection_count", "selection_count", AnalysisColumnType.INT64, true, "Distinct selected option count."))
    dimensions.sortedBy { it.key }.forEach { dimension ->
        add(column("dimension:${dimension.key}", AnalysisPhysicalNames.dimensionColumn(dimension), dimension.type, true, dimension.description))
    }
}

private fun fieldCatalogColumns(): List<AnalysisColumnV1> = listOf(
    column("metadata_hash", "metadata_hash", AnalysisColumnType.STRING, false, "Metadata identity."),
    column("entry_kind", "entry_kind", AnalysisColumnType.STRING, false, "FIELD or OPTION."),
    column("product_id", "product_id", AnalysisColumnType.STRING, false, "Analysis product ID."),
    column("product_release", "product_release", AnalysisColumnType.INT64, false, "Immutable product release number."),
    column("product_snapshot_id", "product_snapshot_id", AnalysisColumnType.STRING, false, "Atomic product snapshot ID."),
    column("team_slug", "team_slug", AnalysisColumnType.STRING, false, "Owning team slug."),
    column("app", "app", AnalysisColumnType.STRING, false, "Source application."),
    column("survey_id", "survey_id", AnalysisColumnType.STRING, false, "Source survey ID."),
    column("definition_hash", "definition_hash", AnalysisColumnType.STRING, true, "Structural definition hash."),
    column("field_id", "field_id", AnalysisColumnType.STRING, false, "Stable structured field ID."),
    column("field_type", "field_type", AnalysisColumnType.STRING, false, "Structured field type."),
    column("rating_variant", "rating_variant", AnalysisColumnType.STRING, true, "Rating variant."),
    column("rating_scale", "rating_scale", AnalysisColumnType.INT64, true, "Rating scale."),
    column("rating_min", "rating_min", AnalysisColumnType.INT64, true, "Minimum rating."),
    column("rating_max", "rating_max", AnalysisColumnType.INT64, true, "Maximum rating."),
    column("max_selections", "max_selections", AnalysisColumnType.INT64, true, "Maximum selections."),
    column("option_id", "option_id", AnalysisColumnType.STRING, true, "Stable option ID."),
    column("option_ordinal", "option_ordinal", AnalysisColumnType.INT64, true, "Option ordinal."),
    column("display_label", "display_label", AnalysisColumnType.STRING, true, "Approved public label only."),
    column("label_source", "label_source", AnalysisColumnType.STRING, false, "REGISTERED_METADATA, PRODUCT_ALIAS or UNKNOWN."),
    column("metadata_revision", "metadata_revision", AnalysisColumnType.STRING, true, "Approved metadata revision."),
    column("first_observed_date", "first_observed_date", AnalysisColumnType.DATE, true, "First structural observation date."),
    column("last_observed_date", "last_observed_date", AnalysisColumnType.DATE, true, "Last structural observation date."),
    column("is_current_label", "is_current_label", AnalysisColumnType.BOOL, false, "Whether this approved label is current."),
)

private fun manifestColumns(): List<AnalysisColumnV1> = listOf(
    column("product_id", "product_id", AnalysisColumnType.STRING, false, "Analysis product ID."),
    column("product_release", "product_release", AnalysisColumnType.INT64, false, "Immutable product release number."),
    column("product_snapshot_id", "product_snapshot_id", AnalysisColumnType.STRING, false, "Atomic product snapshot ID."),
    column("resource_name", "resource_name", AnalysisColumnType.STRING, false, "Public resource name."),
    column("resource_kind", "resource_kind", AnalysisColumnType.STRING, false, "WIDE, LONG or FIELD_CATALOG."),
    column("schema_digest", "schema_digest", AnalysisColumnType.STRING, false, "Public schema digest."),
    column("row_count", "row_count", AnalysisColumnType.INT64, false, "Snapshot row count."),
    column("contract_version", "contract_version", AnalysisColumnType.STRING, false, "Contract version."),
    column("source_snapshot_at", "source_snapshot_at", AnalysisColumnType.TIMESTAMP, false, "Source snapshot timestamp."),
    column("published_at", "published_at", AnalysisColumnType.TIMESTAMP, false, "Publication timestamp."),
    column("data_cutoff_at", "data_cutoff_at", AnalysisColumnType.TIMESTAMP, true, "Product cutoff timestamp."),
    column("snapshot_mode", "snapshot_mode", AnalysisColumnType.STRING, false, "FULL, PURGE_ONLY or SECURITY_REDACTION."),
    column("quality_status", "quality_status", AnalysisColumnType.STRING, false, "PASSED or PASSED_WITH_WARNINGS."),
)

private fun syntheticWideRow(
    productId: String,
    team: String,
    resolved: ResolvedAnalysisSource,
    dimensions: List<AnalysisDimensionDefinitionV1>,
    columns: List<AnalysisColumnV1>,
): JsonObject = syntheticRow(columns) { column ->
    when (column.logicalId) {
        "response_key" -> JsonPrimitive("synthetic_response_1")
        "product_id" -> JsonPrimitive(productId)
        "product_release" -> JsonPrimitive(1)
        "product_snapshot_id" -> JsonPrimitive("synthetic_snapshot_1")
        "team_slug" -> JsonPrimitive(team)
        "app" -> JsonPrimitive(resolved.source.app)
        "survey_id" -> JsonPrimitive(resolved.source.surveyId)
        "survey_type" -> JsonPrimitive(resolved.source.surveyType?.name ?: "UNKNOWN")
        "submitted_date" -> JsonPrimitive("2000-01-01")
        "submitted_hour" -> JsonPrimitive("2000-01-01T00:00:00Z")
        "definition_hash" -> resolved.source.definitionHash?.let(::JsonPrimitive) ?: JsonNull
        "definition_status" -> JsonPrimitive("REGISTERED")
        "flow_hash" -> JsonPrimitive(SYNTHETIC_FLOW_HASH)
        "flow_status" -> JsonPrimitive("PINNED")
        else -> syntheticDynamicValue(column, resolved.selectedFields, dimensions)
    }
}

private fun syntheticLongRow(
    productId: String,
    team: String,
    resolved: ResolvedAnalysisSource,
    field: AnalysisCatalogFieldV1,
    dimensions: List<AnalysisDimensionDefinitionV1>,
    columns: List<AnalysisColumnV1>,
): JsonObject = syntheticRow(columns) { column ->
    when (column.logicalId) {
        "response_key" -> JsonPrimitive("synthetic_response_1")
        "answer_key" -> JsonPrimitive("synthetic_answer_1")
        "product_id" -> JsonPrimitive(productId)
        "product_release" -> JsonPrimitive(1)
        "product_snapshot_id" -> JsonPrimitive("synthetic_snapshot_1")
        "team_slug" -> JsonPrimitive(team)
        "app" -> JsonPrimitive(resolved.source.app)
        "survey_id" -> JsonPrimitive(resolved.source.surveyId)
        "survey_type" -> JsonPrimitive(resolved.source.surveyType?.name ?: "UNKNOWN")
        "submitted_date" -> JsonPrimitive("2000-01-01")
        "submitted_hour" -> JsonPrimitive("2000-01-01T00:00:00Z")
        "definition_hash" -> resolved.source.definitionHash?.let(::JsonPrimitive) ?: JsonNull
        "definition_status" -> JsonPrimitive("REGISTERED")
        "flow_hash" -> JsonPrimitive(SYNTHETIC_FLOW_HASH)
        "flow_status" -> JsonPrimitive("PINNED")
        "field_id" -> JsonPrimitive(field.fieldId)
        "field_type" -> JsonPrimitive(field.fieldType.name)
        "field_metadata_hash" -> JsonPrimitive(syntheticFieldMetadataHash(resolved, field))
        "value_kind" -> JsonPrimitive(if (field.fieldType == FieldType.RATING) "RATING" else "OPTION")
        "rating_value" -> if (field.fieldType == FieldType.RATING) JsonPrimitive(if (field.ratingVariant == RatingVariant.NPS) 0 else 1) else JsonNull
        "option_id" -> field.optionIds?.firstOrNull()?.let(::JsonPrimitive) ?: JsonNull
        "option_metadata_hash" -> field.optionIds?.firstOrNull()?.let { option ->
            JsonPrimitive(syntheticOptionMetadataHash(resolved, field, option))
        } ?: JsonNull
        "selection_count" -> if (field.fieldType in setOf(FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE)) JsonPrimitive(1) else JsonNull
        else -> syntheticDimensionValue(column, dimensions)
    }
}

private fun syntheticFieldMetadataHash(
    resolved: ResolvedAnalysisSource,
    field: AnalysisCatalogFieldV1,
): String = AnalysisCanonicalHash.digest(
    "analysis-field-metadata-v1",
    buildList {
        add(resolved.source.app)
        add(resolved.source.surveyId)
        add(resolved.source.definitionHash ?: "<null>")
        add(field.fieldId)
        add(field.fieldType.name)
        add(field.ratingVariant?.name ?: "<null>")
        add(field.ratingScale?.toString() ?: "<null>")
        add(field.maxSelections?.toString() ?: "<null>")
        field.optionIds.orEmpty().forEach(::add)
        add(field.labelSource.name)
        if (field.labelSource != AnalysisLabelSource.UNKNOWN) add(field.label ?: "<null>")
    },
)

private fun syntheticOptionMetadataHash(
    resolved: ResolvedAnalysisSource,
    field: AnalysisCatalogFieldV1,
    optionId: String,
): String = AnalysisCanonicalHash.digest(
    "analysis-option-metadata-v1",
    listOf(
        syntheticFieldMetadataHash(resolved, field),
        optionId,
        field.optionIds.orEmpty().indexOf(optionId).toString(),
    ),
)

private fun syntheticCatalogRows(
    productId: String,
    team: String,
    resolved: ResolvedAnalysisSource,
    field: AnalysisCatalogFieldV1,
    columns: List<AnalysisColumnV1>,
): List<JsonObject> = buildList {
    add(syntheticCatalogRow(productId, team, resolved, field, null, null, columns))
    field.optionIds?.firstOrNull()?.let { optionId ->
        add(
            syntheticCatalogRow(
                productId,
                team,
                resolved,
                field,
                optionId,
                field.optionIds.indexOf(optionId),
                columns,
            ),
        )
    }
}

private fun syntheticCatalogRow(
    productId: String,
    team: String,
    resolved: ResolvedAnalysisSource,
    field: AnalysisCatalogFieldV1,
    optionId: String?,
    optionOrdinal: Int?,
    columns: List<AnalysisColumnV1>,
): JsonObject = syntheticRow(columns) { column ->
    val ratingMin = if (field.ratingVariant == RatingVariant.NPS) 0 else 1
    val ratingMax = field.ratingScale?.let { scale -> if (field.ratingVariant == RatingVariant.NPS) scale - 1 else scale }
    when (column.logicalId) {
        "metadata_hash" -> JsonPrimitive(
            optionId?.let { syntheticOptionMetadataHash(resolved, field, it) }
                ?: syntheticFieldMetadataHash(resolved, field),
        )
        "entry_kind" -> JsonPrimitive(if (optionId == null) "FIELD" else "OPTION")
        "product_id" -> JsonPrimitive(productId)
        "product_release" -> JsonPrimitive(1)
        "product_snapshot_id" -> JsonPrimitive("synthetic_snapshot_1")
        "team_slug" -> JsonPrimitive(team)
        "app" -> JsonPrimitive(resolved.source.app)
        "survey_id" -> JsonPrimitive(resolved.source.surveyId)
        "definition_hash" -> resolved.source.definitionHash?.let(::JsonPrimitive) ?: JsonNull
        "field_id" -> JsonPrimitive(field.fieldId)
        "field_type" -> JsonPrimitive(field.fieldType.name)
        "rating_variant" -> field.ratingVariant?.name?.let(::JsonPrimitive) ?: JsonNull
        "rating_scale" -> field.ratingScale?.let(::JsonPrimitive) ?: JsonNull
        "rating_min" -> if (field.fieldType == FieldType.RATING) JsonPrimitive(ratingMin) else JsonNull
        "rating_max" -> ratingMax?.let(::JsonPrimitive) ?: JsonNull
        "max_selections" -> field.maxSelections?.let(::JsonPrimitive) ?: JsonNull
        "option_id" -> optionId?.let(::JsonPrimitive) ?: JsonNull
        "option_ordinal" -> optionOrdinal?.let(::JsonPrimitive) ?: JsonNull
        "display_label", "metadata_revision", "first_observed_date", "last_observed_date" -> JsonNull
        "label_source" -> JsonPrimitive("UNKNOWN")
        "is_current_label" -> JsonPrimitive(true)
        else -> JsonNull
    }
}

private fun syntheticManifestRow(
    productId: String,
    resourceName: String,
    resourceKind: AnalysisResourceKind,
    columns: List<AnalysisColumnV1>,
): JsonObject = syntheticRow(columns) { column ->
    when (column.logicalId) {
        "product_id" -> JsonPrimitive(productId)
        "product_release" -> JsonPrimitive(1)
        "product_snapshot_id" -> JsonPrimitive("synthetic_snapshot_1")
        "resource_name" -> JsonPrimitive(resourceName)
        "resource_kind" -> JsonPrimitive(resourceKind.name)
        "schema_digest" -> JsonPrimitive("0".repeat(64))
        "row_count" -> JsonPrimitive(1)
        "contract_version" -> JsonPrimitive(ANALYSIS_CONTRACT_VERSION)
        "source_snapshot_at", "published_at" -> JsonPrimitive("2000-01-01T00:00:00Z")
        "data_cutoff_at" -> JsonNull
        "snapshot_mode" -> JsonPrimitive("FULL")
        "quality_status" -> JsonPrimitive("PASSED")
        else -> JsonNull
    }
}

private fun syntheticRow(
    columns: List<AnalysisColumnV1>,
    value: (AnalysisColumnV1) -> JsonElement,
): JsonObject = JsonObject(columns.associate { column -> column.name to value(column) })

private fun syntheticDynamicValue(
    column: AnalysisColumnV1,
    fields: List<AnalysisCatalogFieldV1>,
    dimensions: List<AnalysisDimensionDefinitionV1>,
): JsonElement {
    if (column.logicalId.startsWith("dimension:")) return syntheticDimensionValue(column, dimensions)
    val field = fields.firstOrNull { column.logicalId.startsWith("field:${it.fieldId}:") } ?: return JsonNull
    return when {
        column.logicalId.endsWith(":applicable") -> JsonPrimitive(true)
        column.logicalId.endsWith(":rating") -> JsonPrimitive(if (field.ratingVariant == RatingVariant.NPS) 0 else 1)
        column.logicalId.endsWith(":option_id") -> field.optionIds?.firstOrNull()?.let(::JsonPrimitive) ?: JsonNull
        column.logicalId.endsWith(":selection_count") -> JsonPrimitive(1)
        column.logicalId.endsWith(":selected") -> JsonPrimitive(
            column.logicalId == field.optionIds?.firstOrNull()?.let { optionId ->
                "field:${field.fieldId}:option:$optionId:selected"
            },
        )
        else -> JsonNull
    }
}

private fun syntheticDimensionValue(
    column: AnalysisColumnV1,
    dimensions: List<AnalysisDimensionDefinitionV1>,
): JsonElement {
    val key = column.logicalId.removePrefix("dimension:")
    val dimension = dimensions.singleOrNull { it.key == key } ?: return JsonNull
    return when (dimension.type) {
        AnalysisColumnType.STRING -> dimension.allowedValues.firstOrNull()?.let(::JsonPrimitive) ?: JsonNull
        AnalysisColumnType.BOOL -> JsonPrimitive(false)
        AnalysisColumnType.FLOAT64 -> JsonPrimitive(0.0)
        AnalysisColumnType.INT64 -> JsonPrimitive(0)
        AnalysisColumnType.DATE -> JsonPrimitive("2000-01-01")
        AnalysisColumnType.TIMESTAMP -> JsonPrimitive("2000-01-01T00:00:00Z")
    }
}
