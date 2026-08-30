package no.nav.lumi.repository

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import no.nav.lumi.domain.AnalysisCatalogContractRevision
import no.nav.lumi.domain.AnalysisCatalogFieldV1
import no.nav.lumi.domain.AnalysisCatalogRevision
import no.nav.lumi.domain.AnalysisCatalogSourceV1
import no.nav.lumi.domain.AnalysisCatalogWarning
import no.nav.lumi.domain.AnalysisDefinitionStatus
import no.nav.lumi.domain.AnalysisDimensionRegistry
import no.nav.lumi.domain.AnalysisFlowStatus
import no.nav.lumi.domain.AnalysisFlowDependencySource
import no.nav.lumi.domain.AnalysisFlowDependencyV1
import no.nav.lumi.domain.AnalysisFieldDependenciesV1
import no.nav.lumi.domain.AnalysisLabelSource
import no.nav.lumi.domain.AnalysisSourceCatalogV1
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyFlowConditionSource
import no.nav.lumi.domain.SurveyFlowDefinitionV1
import no.nav.lumi.domain.computeHash
import no.nav.lumi.validation.SurveyFlowValidator
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

class AnalysisSourceCatalogRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findCatalog(team: String): AnalysisSourceCatalogV1 = dbQuery {
        val connection = TransactionManager.current().connection.connection as java.sql.Connection
        val sources = connection.prepareStatement(
            """
            WITH observations AS (
                SELECT
                    observation.app,
                    observation.survey_id,
                    jsonb_agg(
                        DISTINCT observation.definition_hash
                        ORDER BY observation.definition_hash
                    ) AS definition_hashes,
                    jsonb_agg(
                        DISTINCT observation.flow_hash
                        ORDER BY observation.flow_hash
                    ) AS observed_flow_hashes,
                    jsonb_agg(
                        DISTINCT jsonb_build_object(
                            'definitionHash', observation.definition_hash,
                            'flowHash', observation.flow_hash
                        )
                    ) AS observed_contract_pairs,
                    (
                        array_agg(
                            observation.definition_hash
                            ORDER BY observation.last_submission_at DESC,
                                     observation.definition_hash ASC NULLS FIRST,
                                     observation.flow_hash ASC NULLS FIRST
                        )
                    )[1] AS latest_definition_hash,
                    (
                        array_agg(
                            observation.flow_hash
                            ORDER BY observation.last_submission_at DESC,
                                     observation.definition_hash ASC NULLS FIRST,
                                     observation.flow_hash ASC NULLS FIRST
                        )
                    )[1] AS latest_flow_hash,
                    COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'definitionHash', contract.definition_hash,
                                'flowHash', contract.flow_hash,
                                'definition', contract.definition,
                                'flow', contract.flow_definition
                            )
                            ORDER BY observation.last_submission_at DESC, observation.flow_hash DESC
                        ) FILTER (WHERE contract.flow_hash IS NOT NULL),
                        '[]'::jsonb
                    ) AS registered_flow_contracts,
                    BOOL_OR(observation.flow_hash IS NULL) AS has_unpinned_flow,
                    BOOL_OR(
                        observation.flow_hash IS NOT NULL AND contract.flow_hash IS NULL
                    ) AS has_unknown_flow,
                    BOOL_OR(observation.has_source_id_mismatch) AS has_source_id_mismatch
                FROM analysis_control.analysis_source_contract_observations AS observation
                LEFT JOIN analysis_control.analysis_source_contracts AS contract
                  ON contract.team = observation.team
                 AND contract.app = observation.app
                 AND contract.survey_id = observation.survey_id
                 AND contract.definition_hash = observation.definition_hash
                 AND contract.flow_hash = observation.flow_hash
                WHERE observation.team = ?
                GROUP BY observation.app, observation.survey_id
            )
            SELECT
                source.app,
                source.survey_id,
                definition.definition_hash,
                definition.definition::text,
                definition.source AS definition_source,
                definition.retired_at,
                metadata.archived_at,
                COALESCE(observation.definition_hashes, '[]'::jsonb)::text AS observed_definition_hashes,
                COALESCE(observation.observed_flow_hashes, '[]'::jsonb)::text AS observed_flow_hashes,
                COALESCE(observation.observed_contract_pairs, '[]'::jsonb)::text AS observed_contract_pairs,
                observation.latest_definition_hash,
                observation.latest_flow_hash,
                COALESCE(observation.registered_flow_contracts, '[]'::jsonb)::text AS registered_flow_contracts,
                COALESCE(observation.has_unpinned_flow, FALSE) AS has_unpinned_flow,
                COALESCE(observation.has_unknown_flow, FALSE) AS has_unknown_flow,
                COALESCE(observation.has_source_id_mismatch, FALSE) AS has_source_id_mismatch
            FROM analysis_control.analysis_sources AS source
            LEFT JOIN survey_definitions AS definition
              ON definition.team = source.team
             AND definition.survey_id = source.survey_id
            LEFT JOIN survey_metadata AS metadata
              ON metadata.team = source.team
             AND metadata.survey_id = source.survey_id
            LEFT JOIN observations AS observation
              ON observation.app = source.app
             AND observation.survey_id = source.survey_id
            WHERE source.team = ?
            ORDER BY source.app, source.survey_id
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, team)
            statement.executeQuery().use { result ->
                buildList {
                    while (result.next()) {
                        val app = result.getString("app")
                        val surveyId = result.getString("survey_id")
                        val observedDefinitionHashes = json.decodeFromString<List<String?>>(
                            result.getString("observed_definition_hashes"),
                        ).distinct().sortedWith(nullsFirst(naturalOrder()))
                        val observedFlowHashes = json.decodeFromString<List<String?>>(
                            result.getString("observed_flow_hashes"),
                        ).distinct().sortedWith(nullsFirst(naturalOrder()))
                        val observedContractPairs = json.decodeFromString<List<CatalogObservedContract>>(
                            result.getString("observed_contract_pairs"),
                        ).distinct().sortedWith(
                            compareBy<CatalogObservedContract>(
                                { it.definitionHash ?: "" },
                                { it.flowHash ?: "" },
                            ),
                        )
                        val decodedContracts = runCatching {
                            json.decodeFromString<List<CatalogRegisteredFlowContract>>(
                                result.getString("registered_flow_contracts"),
                            )
                        }
                        val registeredContracts = decodedContracts.getOrDefault(emptyList())
                        val validContracts = registeredContracts.filter { contract ->
                            contract.isValidFor(surveyId)
                        }
                        val contractRevisions = validContracts
                            .map(CatalogRegisteredFlowContract::toCatalogRevision)
                            .distinctBy { it.definitionHash to it.flowHash }
                            .sortedWith(
                                compareBy(
                                    AnalysisCatalogContractRevision::definitionHash,
                                    AnalysisCatalogContractRevision::flowHash,
                                ),
                            )
                        val knownFlowHashes = validContracts.map { it.flowHash }.distinct().sorted()
                        val latestObservedDefinitionHash = result.getString("latest_definition_hash")
                        val latestObservedFlowHash = result.getString("latest_flow_hash")
                        val latestContract = validContracts.singleOrNull {
                            it.definitionHash == latestObservedDefinitionHash &&
                                it.flowHash == latestObservedFlowHash
                        }
                        val currentFlowHash = latestContract?.flowHash
                        val hasUnpinnedFlow = result.getBoolean("has_unpinned_flow")
                        val hasUnknownFlow = result.getBoolean("has_unknown_flow") ||
                            decodedContracts.isFailure || validContracts.size != registeredContracts.size
                        val hasSourceIdMismatch = result.getBoolean("has_source_id_mismatch")
                        val definitionJson = result.getString("definition")
                        val definition = definitionJson?.let { json.decodeFromString<SurveyDefinition>(it) }
                        val definitionHash = result.getString("definition_hash")
                        val dependenciesByField = validContracts
                            .flatMap { contract -> contract.flow.fields }
                            .groupBy { it.fieldId }
                            .mapValues { (_, flowFields) ->
                                flowFields.flatMap { flowField ->
                                    flowField.visibleIf?.conditions.orEmpty().map { condition ->
                                        AnalysisFlowDependencyV1(
                                            source = when (condition.source) {
                                                SurveyFlowConditionSource.ANSWER -> AnalysisFlowDependencySource.ANSWER
                                                SurveyFlowConditionSource.METADATA -> AnalysisFlowDependencySource.METADATA
                                            },
                                            key = condition.key,
                                        )
                                    }
                                }.distinct().sortedWith(
                                    compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key),
                                )
                            }
                        val definitionStatus = when {
                            definition == null && definitionHash == null -> AnalysisDefinitionStatus.MISSING
                            result.getObject("retired_at") != null || definition == null -> AnalysisDefinitionStatus.RETIRED
                            result.getString("definition_source") == SurveyDefinitionSource.API ->
                                AnalysisDefinitionStatus.REGISTERED
                            else -> AnalysisDefinitionStatus.AUTO_DERIVED
                        }
                        val warnings = buildSet {
                            if (observedDefinitionHashes.any { it == null }) {
                                add(AnalysisCatalogWarning.LEGACY_DEFINITION_OBSERVED)
                            }
                            if (
                                observedContractPairs.any { observed ->
                                    observed.definitionHash != null &&
                                        observed.definitionHash != definitionHash &&
                                        validContracts.none { contract ->
                                            contract.definitionHash == observed.definitionHash &&
                                                contract.flowHash == observed.flowHash
                                        }
                                }
                            ) {
                                add(AnalysisCatalogWarning.HISTORICAL_DEFINITION_UNRESOLVED)
                            }
                            if (hasSourceIdMismatch) {
                                add(AnalysisCatalogWarning.SOURCE_ID_MISMATCH)
                            }
                            if (hasUnpinnedFlow) {
                                add(AnalysisCatalogWarning.LEGACY_FLOW_OBSERVED)
                            }
                            if (hasUnknownFlow) {
                                add(AnalysisCatalogWarning.UNKNOWN_FLOW_OBSERVED)
                            }
                            if (definition != null && definition.surveyId != surveyId) {
                                add(AnalysisCatalogWarning.SOURCE_ID_MISMATCH)
                            }
                            if (definition != null && definitionHash != definition.computeHash()) {
                                add(AnalysisCatalogWarning.DEFINITION_CONTENT_MISMATCH)
                            }
                        }
                        add(
                            AnalysisCatalogSourceV1(
                                app = app,
                                surveyId = surveyId,
                                surveyType = definition?.surveyType,
                                archived = result.getObject("archived_at") != null,
                                definitionHash = definitionHash,
                                definitionStatus = definitionStatus,
                                observedDefinitionHashes = observedDefinitionHashes,
                                flowHash = currentFlowHash,
                                flowHashes = knownFlowHashes,
                                observedFlowHashes = observedFlowHashes,
                                flowStatus = if (currentFlowHash != null && !hasUnknownFlow) {
                                    AnalysisFlowStatus.PINNED
                                } else {
                                    AnalysisFlowStatus.UNPINNED
                                },
                                fields = definition?.fields.orEmpty()
                                    .sortedBy { it.fieldId }
                                    .map { field ->
                                        AnalysisCatalogFieldV1(
                                            fieldId = field.fieldId,
                                            fieldType = field.fieldType,
                                            ratingVariant = field.ratingVariant,
                                            ratingScale = field.ratingScale,
                                            optionIds = field.optionIds,
                                            maxSelections = field.maxSelections,
                                            // Submission labels and authoring labels are not approved
                                            // public metadata and are intentionally unavailable here.
                                            label = null,
                                            labelSource = AnalysisLabelSource.UNKNOWN,
                                            flowDependencies = dependenciesByField[field.fieldId].orEmpty(),
                                        )
                                    },
                                warnings = warnings.sortedBy { it.name },
                                contractRevisions = contractRevisions,
                            ),
                        )
                    }
                }
            }
        }
        val dimensions = AnalysisDimensionRegistry.snapshot()
        AnalysisSourceCatalogV1(
            team = team,
            catalogRevision = AnalysisCatalogRevision.compute(team, sources, dimensions),
            sources = sources,
            dimensions = dimensions.dimensions,
        )
    }
}

@Serializable
private data class CatalogRegisteredFlowContract(
    val definitionHash: String,
    val flowHash: String,
    val definition: SurveyDefinition,
    val flow: SurveyFlowDefinitionV1,
) {
    fun isValidFor(surveyId: String): Boolean = runCatching {
        check(definition.surveyId == surveyId)
        check(definition.computeHash() == definitionHash)
        check(flow.computeHash() == flowHash)
        SurveyFlowValidator.validate(flow, definition)
    }.isSuccess

    fun toCatalogRevision(): AnalysisCatalogContractRevision {
        val dependencies = flow.fields
            .map { flowField ->
                AnalysisFieldDependenciesV1(
                    fieldId = flowField.fieldId,
                    dependencies = flowField.visibleIf?.conditions.orEmpty()
                        .map { condition ->
                            AnalysisFlowDependencyV1(
                                source = when (condition.source) {
                                    SurveyFlowConditionSource.ANSWER -> AnalysisFlowDependencySource.ANSWER
                                    SurveyFlowConditionSource.METADATA -> AnalysisFlowDependencySource.METADATA
                                },
                                key = condition.key,
                            )
                        }
                        .distinct()
                        .sortedWith(compareBy(AnalysisFlowDependencyV1::source, AnalysisFlowDependencyV1::key)),
                )
            }
            .sortedBy { it.fieldId }
        return AnalysisCatalogContractRevision(
            definitionHash = definitionHash,
            flowHash = flowHash,
            surveyType = definition.surveyType,
            fields = definition.fields.sortedBy { it.fieldId }.map { field ->
                AnalysisCatalogFieldV1(
                    fieldId = field.fieldId,
                    fieldType = field.fieldType,
                    ratingVariant = field.ratingVariant,
                    ratingScale = field.ratingScale,
                    optionIds = field.optionIds,
                    maxSelections = field.maxSelections,
                    label = null,
                    labelSource = AnalysisLabelSource.UNKNOWN,
                    flowDependencies = dependencies.singleOrNull { it.fieldId == field.fieldId }?.dependencies.orEmpty(),
                )
            },
            evaluatorVersion = flow.evaluatorVersion,
            dependenciesByField = dependencies,
        )
    }
}

@Serializable
private data class CatalogObservedContract(
    val definitionHash: String?,
    val flowHash: String?,
)
