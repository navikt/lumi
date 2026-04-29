package no.nav.lumi.repository

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.domain.SurveyDefinition
import org.jetbrains.exposed.v1.core.*
import org.jetbrains.exposed.v1.jdbc.*

data class StoredSurveyDefinition(
    val team: String,
    val surveyId: String,
    val definitionHash: String,
    val definition: SurveyDefinition
)

class SurveyDefinitionRepository {
    private val json = Json { ignoreUnknownKeys = false }

    suspend fun findByTeamAndSurveyId(team: String, surveyId: String): StoredSurveyDefinition? {
        return dbQuery {
            SurveyDefinitionTable.selectAll()
                .where { (SurveyDefinitionTable.team eq team) and (SurveyDefinitionTable.surveyId eq surveyId) }
                .singleOrNull()
                ?.let { row ->
                    StoredSurveyDefinition(
                        team = row[SurveyDefinitionTable.team],
                        surveyId = row[SurveyDefinitionTable.surveyId],
                        definitionHash = row[SurveyDefinitionTable.definitionHash],
                        definition = json.decodeFromString(row[SurveyDefinitionTable.definition])
                    )
                }
        }
    }

    suspend fun countByTeam(team: String): Long {
        return dbQuery {
            SurveyDefinitionTable.selectAll()
                .where { SurveyDefinitionTable.team eq team }
                .count()
        }
    }

    suspend fun insertIgnore(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String
    ): Boolean {
        return dbQuery {
            SurveyDefinitionTable.insertIgnore {
                it[SurveyDefinitionTable.team] = team
                it[SurveyDefinitionTable.surveyId] = definition.surveyId
                it[SurveyDefinitionTable.definitionHash] = definitionHash
                it[SurveyDefinitionTable.definition] = json.encodeToString(definition)
            }.insertedCount > 0
        }
    }
}
