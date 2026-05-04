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

    /**
     * Atomically check team count limit and insert if under limit.
     * Returns true if inserted, false if duplicate (UNIQUE constraint).
     * Throws if team is at or over the limit.
     */
    suspend fun insertIfUnderLimit(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int
    ): Boolean {
        return dbQuery {
            val count = SurveyDefinitionTable.selectAll()
                .where { SurveyDefinitionTable.team eq team }
                .count()
            if (count >= maxDefinitions) {
                throw no.nav.lumi.config.exception.ApiErrorException.TooManyRequestsException(
                    "Definition limit exceeded for team=$team (max=$maxDefinitions)"
                )
            }
            SurveyDefinitionTable.insertIgnore {
                it[SurveyDefinitionTable.team] = team
                it[SurveyDefinitionTable.surveyId] = definition.surveyId
                it[SurveyDefinitionTable.definitionHash] = definitionHash
                it[SurveyDefinitionTable.definition] = json.encodeToString(definition)
            }.insertedCount > 0
        }
    }
}
