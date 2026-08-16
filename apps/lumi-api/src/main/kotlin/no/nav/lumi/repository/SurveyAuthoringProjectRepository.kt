package no.nav.lumi.repository

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import no.nav.lumi.domain.SurveyAuthoringProject
import no.nav.lumi.domain.SurveyAuthoringProjectSummary
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import java.sql.Connection
import java.time.OffsetDateTime
import java.util.UUID

class SurveyAuthoringProjectRepository {
    private val json = Json

    suspend fun create(
        team: String,
        name: String,
        surveyId: String,
        document: JsonObject,
        principalIdentity: String,
        maxProjects: Int,
    ): SurveyAuthoringProject? = dbQuery {
        val connection = TransactionManager.current().connection.connection as Connection
        connection.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?))").use { lock ->
            lock.setString(1, "survey-authoring:$team")
            lock.execute()
        }

        val sql = """
            INSERT INTO survey_authoring_projects
                (team, name, survey_id, draft, created_by, updated_by)
            SELECT ?, ?, ?, ?::jsonb, ?, ?
            WHERE (SELECT count(*) FROM survey_authoring_projects WHERE team = ?) < ?
            RETURNING id
        """.trimIndent()
        val id = connection.prepareStatement(sql).use { statement ->
            statement.setString(1, team)
            statement.setString(2, name)
            statement.setString(3, surveyId)
            statement.setString(4, document.toString())
            statement.setString(5, principalIdentity)
            statement.setString(6, principalIdentity)
            statement.setString(7, team)
            statement.setInt(8, maxProjects)
            statement.executeQuery().use { result ->
                if (result.next()) result.getObject("id", UUID::class.java) else null
            }
        }

        id?.let { findByIdInCurrentTransaction(team, it) }
    }

    suspend fun findByTeam(team: String): List<SurveyAuthoringProjectSummary> = dbQuery {
        SurveyAuthoringProjectTable.selectAll()
            .where { SurveyAuthoringProjectTable.team eq team }
            .orderBy(SurveyAuthoringProjectTable.updatedAt to SortOrder.DESC)
            .map(::toSummary)
    }

    suspend fun findById(team: String, id: UUID): SurveyAuthoringProject? = dbQuery {
        findByIdInCurrentTransaction(team, id)
    }

    suspend fun updateDraft(
        team: String,
        id: UUID,
        expectedVersion: Long,
        name: String,
        surveyId: String,
        document: JsonObject,
        principalIdentity: String,
    ): SurveyAuthoringProject? = dbQuery {
        val updated = SurveyAuthoringProjectTable.update({
            (SurveyAuthoringProjectTable.id eq id) and
                (SurveyAuthoringProjectTable.team eq team) and
                (SurveyAuthoringProjectTable.draftVersion eq expectedVersion)
        }) {
            it[SurveyAuthoringProjectTable.name] = name
            it[SurveyAuthoringProjectTable.surveyId] = surveyId
            it[draft] = document.toString()
            it[draftVersion] = expectedVersion + 1
            it[updatedBy] = principalIdentity
            it[updatedAt] = OffsetDateTime.now()
        }

        if (updated == 0) null else findByIdInCurrentTransaction(team, id)
    }

    private fun findByIdInCurrentTransaction(team: String, id: UUID): SurveyAuthoringProject? =
        SurveyAuthoringProjectTable.selectAll()
            .where {
                (SurveyAuthoringProjectTable.id eq id) and
                    (SurveyAuthoringProjectTable.team eq team)
            }
            .singleOrNull()
            ?.let(::toProject)

    private fun toProject(row: ResultRow) = SurveyAuthoringProject(
        id = row[SurveyAuthoringProjectTable.id].toString(),
        team = row[SurveyAuthoringProjectTable.team],
        name = row[SurveyAuthoringProjectTable.name],
        surveyId = row[SurveyAuthoringProjectTable.surveyId],
        document = json.parseToJsonElement(row[SurveyAuthoringProjectTable.draft]) as JsonObject,
        draftVersion = row[SurveyAuthoringProjectTable.draftVersion],
        createdAt = row[SurveyAuthoringProjectTable.createdAt].toString(),
        updatedAt = row[SurveyAuthoringProjectTable.updatedAt].toString(),
    )

    private fun toSummary(row: ResultRow) = SurveyAuthoringProjectSummary(
        id = row[SurveyAuthoringProjectTable.id].toString(),
        team = row[SurveyAuthoringProjectTable.team],
        name = row[SurveyAuthoringProjectTable.name],
        surveyId = row[SurveyAuthoringProjectTable.surveyId],
        draftVersion = row[SurveyAuthoringProjectTable.draftVersion],
        createdAt = row[SurveyAuthoringProjectTable.createdAt].toString(),
        updatedAt = row[SurveyAuthoringProjectTable.updatedAt].toString(),
    )
}
