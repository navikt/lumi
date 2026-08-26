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
    val definition: SurveyDefinition?,
    val source: String = SurveyDefinitionSource.AUTO,
    val lastSubmissionAt: Instant = Instant.EPOCH,
    val definitionRetentionAt: Instant = Instant.MAX,
    val retiredAt: Instant? = null,
)

data class SurveyRetentionCandidate(
    val surveyId: String,
    val lastActivityAt: Instant,
    val scheduledFor: Instant,
)

object SurveyDefinitionSource {
    const val AUTO = "auto"
    const val API = "api"
}

class SurveyDefinitionRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findByTeamAndSurveyId(team: String, surveyId: String): StoredSurveyDefinition? {
        return dbQuery {
            findByTeamAndSurveyIdInCurrentTransaction(team, surveyId)
        }
    }

    suspend fun findUpcomingRetentionCandidates(
        team: String,
        scheduledBefore: Instant,
    ): List<SurveyRetentionCandidate> = dbQuery {
        SurveyDefinitionTable
            .select(
                SurveyDefinitionTable.surveyId,
                SurveyDefinitionTable.lastSubmissionAt,
                SurveyDefinitionTable.definitionRetentionAt,
            )
            .where {
                (SurveyDefinitionTable.team eq team) and
                    SurveyDefinitionTable.retiredAt.isNull() and
                    (SurveyDefinitionTable.definitionRetentionAt lessEq scheduledBefore)
            }
            .orderBy(SurveyDefinitionTable.definitionRetentionAt to SortOrder.ASC)
            .map { row ->
                SurveyRetentionCandidate(
                    surveyId = row[SurveyDefinitionTable.surveyId],
                    lastActivityAt = row[SurveyDefinitionTable.lastSubmissionAt],
                    scheduledFor = row[SurveyDefinitionTable.definitionRetentionAt],
                )
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

    suspend fun insertApiDefinitionIfUnderLimit(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int
    ): Int {
        return dbQuery {
            insertIfUnderLimitInCurrentTransaction(
                team = team,
                definition = definition,
                definitionHash = definitionHash,
                maxDefinitions = maxDefinitions,
                source = SurveyDefinitionSource.API
            )
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

    suspend fun updateApiDefinitionIfHashMatches(
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
                newDefinitionHash = newDefinitionHash,
                source = SurveyDefinitionSource.API
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
                    definition = row[SurveyDefinitionTable.definition]
                        ?.let { json.decodeFromString(it) },
                    source = row[SurveyDefinitionTable.dbSource],
                    lastSubmissionAt = row[SurveyDefinitionTable.lastSubmissionAt],
                    definitionRetentionAt = row[SurveyDefinitionTable.definitionRetentionAt],
                    retiredAt = row[SurveyDefinitionTable.retiredAt],
                )
            }
    }

    internal fun insertIfUnderLimitInCurrentTransaction(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int,
        source: String = SurveyDefinitionSource.AUTO
    ): Int {
        val definitionJson = json.encodeToString(definition)
        val transaction = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current()
        val conn = transaction.connection.connection as java.sql.Connection

        conn.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?))").use { lock ->
            lock.setString(1, team)
            lock.execute()
        }

        val sql = """
            INSERT INTO survey_definitions (id, team, survey_id, definition_hash, definition, source)
            SELECT gen_random_uuid(), ?, ?, ?, ?::jsonb, ?
            WHERE (SELECT count(*) FROM survey_definitions WHERE team = ?) < ?
            ON CONFLICT (team, survey_id) DO NOTHING
        """.trimIndent()

        return conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, team)
            stmt.setString(2, definition.surveyId)
            stmt.setString(3, definitionHash)
            stmt.setString(4, definitionJson)
            stmt.setString(5, source)
            stmt.setString(6, team)
            stmt.setInt(7, maxDefinitions)
            stmt.executeUpdate()
        }
    }

    internal fun insertApiDefinitionIfUnderLimitInCurrentTransaction(
        team: String,
        definition: SurveyDefinition,
        definitionHash: String,
        maxDefinitions: Int
    ): Int {
        return insertIfUnderLimitInCurrentTransaction(
            team = team,
            definition = definition,
            definitionHash = definitionHash,
            maxDefinitions = maxDefinitions,
            source = SurveyDefinitionSource.API
        )
    }

    internal fun updateDefinitionIfHashMatchesInCurrentTransaction(
        team: String,
        surveyId: String,
        expectedDefinitionHash: String,
        definition: SurveyDefinition,
        newDefinitionHash: String,
        source: String? = null
    ): Boolean {
        val definitionJson = json.encodeToString(definition)
        return SurveyDefinitionTable.update({
            (SurveyDefinitionTable.team eq team) and
                (SurveyDefinitionTable.surveyId eq surveyId) and
                (SurveyDefinitionTable.definitionHash eq expectedDefinitionHash)
        }) {
            it[SurveyDefinitionTable.definitionHash] = newDefinitionHash
            it[SurveyDefinitionTable.definition] = definitionJson
            it[SurveyDefinitionTable.retiredAt] = null
            if (source != null) {
                it[SurveyDefinitionTable.dbSource] = source
            }
            it[SurveyDefinitionTable.updatedAt] = Instant.now()
        } > 0
    }

    internal fun recordStoredSubmissionInCurrentTransaction(team: String, surveyId: String) {
        val transaction = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current()
        val conn = transaction.connection.connection as java.sql.Connection
        conn.prepareStatement(
            """
                UPDATE survey_definitions
                SET last_submission_at = GREATEST(last_submission_at, now()),
                    definition_retention_at = GREATEST(
                        definition_retention_at,
                        now() + INTERVAL '18 months'
                    )
                WHERE team = ? AND survey_id = ?
            """.trimIndent()
        ).use { statement ->
            statement.setString(1, team)
            statement.setString(2, surveyId)
            check(statement.executeUpdate() == 1) {
                "Survey definition disappeared while recording stored submission"
            }
        }
    }

    internal fun updateApiDefinitionIfHashMatchesInCurrentTransaction(
        team: String,
        surveyId: String,
        expectedDefinitionHash: String,
        definition: SurveyDefinition,
        newDefinitionHash: String
    ): Boolean {
        return updateDefinitionIfHashMatchesInCurrentTransaction(
            team = team,
            surveyId = surveyId,
            expectedDefinitionHash = expectedDefinitionHash,
            definition = definition,
            newDefinitionHash = newDefinitionHash,
            source = SurveyDefinitionSource.API
        )
    }
}
