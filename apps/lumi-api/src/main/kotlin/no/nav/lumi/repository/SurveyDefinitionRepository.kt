package no.nav.lumi.repository

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.domain.SurveyDefinition
import org.jetbrains.exposed.v1.core.*
import org.jetbrains.exposed.v1.jdbc.*
import java.time.Instant

data class StoredSurveyDefinition(
    val team: String,
    val surveyId: String,
    val definitionHash: String,
    val definition: SurveyDefinition
)

class SurveyDefinitionRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findByTeamAndSurveyId(team: String, surveyId: String): StoredSurveyDefinition? {
        return dbQuery {
            findByTeamAndSurveyIdInCurrentTransaction(team, surveyId)
        }
    }

    /**
     * Atomically check team count limit and insert if under limit.
     *
     * Uses pg_advisory_xact_lock to serialize inserts per team, preventing
     * concurrent transactions from both reading count=499 and overshooting
     * the limit under READ COMMITTED isolation. The advisory lock is scoped
     * to the transaction and released automatically on commit/rollback.
     *
     * Returns:
     *  - 1 if inserted successfully
     *  - 0 if duplicate (UNIQUE constraint on team+surveyId) or team at/over limit
     */
    suspend fun insertIfUnderLimit(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int
    ): Int {
        return dbQuery {
            insertIfUnderLimitInCurrentTransaction(team, definition, definitionHash, maxDefinitions)
        }
    }

    suspend fun updateDefinitionIfHashMatches(
        team: String,
        surveyId: String,
        expectedDefinitionHash: String,
        definition: SurveyDefinition,
        newDefinitionHash: String
    ): Boolean {
        return dbQuery {
            updateDefinitionIfHashMatchesInCurrentTransaction(
                team = team,
                surveyId = surveyId,
                expectedDefinitionHash = expectedDefinitionHash,
                definition = definition,
                newDefinitionHash = newDefinitionHash
            )
        }
    }

    internal fun findByTeamAndSurveyIdInCurrentTransaction(team: String, surveyId: String): StoredSurveyDefinition? {
        return SurveyDefinitionTable.selectAll()
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

    internal fun insertIfUnderLimitInCurrentTransaction(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int
    ): Int {
        val definitionJson = json.encodeToString(definition)
        val transaction = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current()
        val conn = transaction.connection.connection as java.sql.Connection

        conn.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?))").use { lock ->
            lock.setString(1, team)
            lock.execute()
        }

        val sql = """
            INSERT INTO survey_definitions (id, team, survey_id, definition_hash, definition)
            SELECT gen_random_uuid(), ?, ?, ?, ?::jsonb
            WHERE (SELECT count(*) FROM survey_definitions WHERE team = ?) < ?
            ON CONFLICT (team, survey_id) DO NOTHING
        """.trimIndent()

        return conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, team)
            stmt.setString(2, definition.surveyId)
            stmt.setString(3, definitionHash)
            stmt.setString(4, definitionJson)
            stmt.setString(5, team)
            stmt.setInt(6, maxDefinitions)
            stmt.executeUpdate()
        }
    }

    internal fun updateDefinitionIfHashMatchesInCurrentTransaction(
        team: String,
        surveyId: String,
        expectedDefinitionHash: String,
        definition: SurveyDefinition,
        newDefinitionHash: String
    ): Boolean {
        val definitionJson = json.encodeToString(definition)
        return SurveyDefinitionTable.update({
            (SurveyDefinitionTable.team eq team) and
                (SurveyDefinitionTable.surveyId eq surveyId) and
                (SurveyDefinitionTable.definitionHash eq expectedDefinitionHash)
        }) {
            it[SurveyDefinitionTable.definitionHash] = newDefinitionHash
            it[SurveyDefinitionTable.definition] = definitionJson
            it[SurveyDefinitionTable.updatedAt] = Instant.now()
        } > 0
    }
}
