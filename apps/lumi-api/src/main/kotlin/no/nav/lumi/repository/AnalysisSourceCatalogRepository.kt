package no.nav.lumi.repository

import kotlinx.serialization.json.Json
import no.nav.lumi.domain.AnalysisCatalogFieldV1
import no.nav.lumi.domain.AnalysisCatalogRevision
import no.nav.lumi.domain.AnalysisCatalogSourceV1
import no.nav.lumi.domain.AnalysisCatalogWarning
import no.nav.lumi.domain.AnalysisDefinitionStatus
import no.nav.lumi.domain.AnalysisDimensionRegistry
import no.nav.lumi.domain.AnalysisFlowStatus
import no.nav.lumi.domain.AnalysisLabelSource
import no.nav.lumi.domain.AnalysisSourceCatalogV1
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.computeHash
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

class AnalysisSourceCatalogRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findCatalog(team: String): AnalysisSourceCatalogV1 = dbQuery {
        val connection = TransactionManager.current().connection.connection as java.sql.Connection
        val sources = connection.prepareStatement(
            """
            WITH observations AS (
                SELECT
                    app,
                    COALESCE(survey_id, feedback_json ->> 'surveyId') AS catalog_survey_id,
                    jsonb_agg(DISTINCT definition_hash ORDER BY definition_hash) AS definition_hashes,
                    BOOL_OR(
                        survey_id IS NOT NULL AND
                        feedback_json ->> 'surveyId' IS NOT NULL AND
                        survey_id <> feedback_json ->> 'surveyId'
                    ) AS has_source_id_mismatch
                FROM feedback
                WHERE team = ?
                  AND length(btrim(COALESCE(survey_id, feedback_json ->> 'surveyId', ''))) > 0
                GROUP BY app, COALESCE(survey_id, feedback_json ->> 'surveyId')
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
             AND observation.catalog_survey_id = source.survey_id
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
                        val hasSourceIdMismatch = result.getBoolean("has_source_id_mismatch")
                        val definitionJson = result.getString("definition")
                        val definition = definitionJson?.let { json.decodeFromString<SurveyDefinition>(it) }
                        val definitionHash = result.getString("definition_hash")
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
                                observedDefinitionHashes.any { observed ->
                                    observed != null && observed != definitionHash
                                }
                            ) {
                                add(AnalysisCatalogWarning.HISTORICAL_DEFINITION_UNRESOLVED)
                            }
                            if (hasSourceIdMismatch) {
                                add(AnalysisCatalogWarning.SOURCE_ID_MISMATCH)
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
                                flowHash = null,
                                flowStatus = AnalysisFlowStatus.UNPINNED,
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
                                        )
                                    },
                                warnings = warnings.sortedBy { it.name },
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
