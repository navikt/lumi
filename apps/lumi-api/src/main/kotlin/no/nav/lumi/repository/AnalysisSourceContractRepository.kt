package no.nav.lumi.repository

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyFlowDefinitionV1
import no.nav.lumi.domain.computeHash
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

class AnalysisSourceContractRepository {
    private val json = Json {
        encodeDefaults = true
        explicitNulls = true
    }

    internal fun registerInCurrentTransaction(
        team: String,
        app: String,
        definitionHash: String,
        definition: SurveyDefinition,
        flow: SurveyFlowDefinitionV1,
    ): String? {
        check(definition.computeHash() == definitionHash) {
            "Cannot register a source contract with a mismatched definition hash"
        }

        val normalizedFlow = flow.normalized()
        val flowHash = normalizedFlow.computeHash()
        val definitionJson = json.encodeToString(definition)
        val flowJson = json.encodeToString(normalizedFlow)
        val connection = TransactionManager.current().connection.connection as java.sql.Connection

        connection.prepareStatement(
            "SELECT pg_advisory_xact_lock(" +
                "analysis_control.source_contract_lock_key(?, ?, ?, ?))",
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, app)
            statement.setString(3, definition.surveyId)
            statement.setString(4, definitionHash)
            statement.execute()
        }

        if (
            readAndVerifyContract(
                connection,
                team,
                app,
                definition.surveyId,
                definitionHash,
                flowHash,
                definitionJson,
                flowJson,
            )
        ) {
            return flowHash
        }

        if (flowJson.toByteArray(Charsets.UTF_8).size > MAX_FLOW_CONTRACT_BYTES) return null

        // The common path above only takes the source lock. A team-wide lock
        // is needed for new revisions so the aggregate byte budget remains
        // race-free without serializing every submission for a team.
        connection.prepareStatement(
            "SELECT pg_advisory_xact_lock(" +
                "analysis_control.source_contract_team_lock_key(?))",
        ).use { statement ->
            statement.setString(1, team)
            statement.execute()
        }

        connection.prepareStatement(
            """
            WITH candidate AS (
                SELECT
                    ?::text AS team,
                    ?::text AS app,
                    ?::text AS survey_id,
                    ?::text AS definition_hash,
                    ?::text AS flow_hash,
                    ?::jsonb AS definition,
                    ?::jsonb AS flow_definition
            )
            INSERT INTO analysis_control.analysis_source_contracts (
                team, app, survey_id, definition_hash, flow_hash, definition, flow_definition
            )
            SELECT
                candidate.team,
                candidate.app,
                candidate.survey_id,
                candidate.definition_hash,
                candidate.flow_hash,
                candidate.definition,
                candidate.flow_definition
            FROM candidate
            WHERE (
                SELECT count(*)
                FROM analysis_control.analysis_source_contracts
                WHERE team = candidate.team
                  AND app = candidate.app
                  AND survey_id = candidate.survey_id
                  AND definition_hash = candidate.definition_hash
            ) < ?
              AND octet_length(candidate.flow_definition::text) <= ?
              AND (
                  SELECT COALESCE(
                      sum(octet_length(definition::text) + octet_length(flow_definition::text)),
                      0
                  )
                  FROM analysis_control.analysis_source_contracts
                  WHERE team = candidate.team
              ) + octet_length(candidate.definition::text) +
                  octet_length(candidate.flow_definition::text) <= ?
            ON CONFLICT (team, app, survey_id, definition_hash, flow_hash) DO NOTHING
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, app)
            statement.setString(3, definition.surveyId)
            statement.setString(4, definitionHash)
            statement.setString(5, flowHash)
            statement.setString(6, definitionJson)
            statement.setString(7, flowJson)
            statement.setInt(8, MAX_FLOW_REVISIONS_PER_SOURCE_DEFINITION)
            statement.setInt(9, MAX_FLOW_CONTRACT_BYTES)
            statement.setInt(10, MAX_TEAM_CONTRACT_BYTES)
            statement.executeUpdate()
        }

        if (
            !readAndVerifyContract(
                connection,
                team,
                app,
                definition.surveyId,
                definitionHash,
                flowHash,
                definitionJson,
                flowJson,
            )
        ) {
            return null
        }

        return flowHash
    }

    private fun readAndVerifyContract(
        connection: java.sql.Connection,
        team: String,
        app: String,
        surveyId: String,
        definitionHash: String,
        flowHash: String,
        definitionJson: String,
        flowJson: String,
    ): Boolean {
        connection.prepareStatement(
            """
            SELECT definition::text, flow_definition::text
            FROM analysis_control.analysis_source_contracts
            WHERE team = ? AND app = ? AND survey_id = ?
              AND definition_hash = ? AND flow_hash = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, app)
            statement.setString(3, surveyId)
            statement.setString(4, definitionHash)
            statement.setString(5, flowHash)
            statement.executeQuery().use { result ->
                if (!result.next()) return false
                check(json.parseToJsonElement(result.getString(1)) == json.parseToJsonElement(definitionJson)) {
                    "Stored source contract definition does not match its hash"
                }
                check(json.parseToJsonElement(result.getString(2)) == json.parseToJsonElement(flowJson)) {
                    "Stored source flow does not match its hash"
                }
            }
        }
        return true
    }

    internal companion object {
        const val MAX_FLOW_REVISIONS_PER_SOURCE_DEFINITION = 50
        const val MAX_FLOW_CONTRACT_BYTES = 64 * 1024
        const val MAX_TEAM_CONTRACT_BYTES = 16 * 1024 * 1024
    }
}
