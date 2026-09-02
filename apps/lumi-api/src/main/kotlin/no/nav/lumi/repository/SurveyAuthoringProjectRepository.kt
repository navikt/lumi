package no.nav.lumi.repository

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import no.nav.lumi.domain.SurveyAuthoringLatestRevision
import no.nav.lumi.domain.SurveyAuthoringProject
import no.nav.lumi.domain.SurveyAuthoringProjectSummary
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.select
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
        val projects = SurveyAuthoringProjectTable.selectAll()
            .where { SurveyAuthoringProjectTable.team eq team }
            .orderBy(SurveyAuthoringProjectTable.updatedAt to SortOrder.DESC)
            .map(::toSummary)
        if (projects.isEmpty()) return@dbQuery projects

        // One query for the whole team: newest revision per project. Scalar
        // columns only — never the JSONB documents — and ordered by revision
        // number so the first row seen per project wins.
        val latestByProject = mutableMapOf<String, SurveyAuthoringLatestRevision>()
        SurveyAuthoringRevisionTable.select(
            SurveyAuthoringRevisionTable.id,
            SurveyAuthoringRevisionTable.projectId,
            SurveyAuthoringRevisionTable.revisionNumber,
            SurveyAuthoringRevisionTable.draftVersion,
            SurveyAuthoringRevisionTable.createdAt,
        )
            .where {
                SurveyAuthoringRevisionTable.projectId inList projects.map { UUID.fromString(it.id) }
            }
            .orderBy(SurveyAuthoringRevisionTable.revisionNumber to SortOrder.DESC)
            .forEach { row ->
                val projectId = row[SurveyAuthoringRevisionTable.projectId].toString()
                if (projectId !in latestByProject) {
                    latestByProject[projectId] = SurveyAuthoringLatestRevision(
                        id = row[SurveyAuthoringRevisionTable.id].toString(),
                        revisionNumber = row[SurveyAuthoringRevisionTable.revisionNumber],
                        draftVersion = row[SurveyAuthoringRevisionTable.draftVersion],
                        createdAt = row[SurveyAuthoringRevisionTable.createdAt].toString(),
                    )
                }
            }
        projects.map { project -> project.copy(latestRevision = latestByProject[project.id]) }
    }

    suspend fun findById(team: String, id: UUID): SurveyAuthoringProject? = dbQuery {
        findByIdInCurrentTransaction(team, id)
    }

    /** Deletes the project; revisions follow via the DB cascade. */
    suspend fun deleteById(team: String, id: UUID): Boolean = dbQuery {
        // Same per-project advisory lock as revision creation: a delete must
        // never commit between the revision flow's project read and its
        // insert — that would surface as an FK violation (500) instead of a
        // clean 404/cascade.
        val connection = TransactionManager.current().connection.connection as Connection
        connection.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?))").use { lock ->
            lock.setString(1, "survey-authoring-revision:$id")
            lock.execute()
        }
        SurveyAuthoringProjectTable.deleteWhere {
            (SurveyAuthoringProjectTable.team eq team) and
                (SurveyAuthoringProjectTable.id eq id)
        } > 0
    }

    sealed interface DraftUpdateResult {
        data class Updated(val project: SurveyAuthoringProject) : DraftUpdateResult
        data object NotFound : DraftUpdateResult
        data object VersionConflict : DraftUpdateResult
    }

    suspend fun updateDraft(
        team: String,
        id: UUID,
        expectedVersion: Long,
        name: String,
        surveyId: String,
        document: JsonObject,
        principalIdentity: String,
    ): DraftUpdateResult = dbQuery {
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

        when {
            updated > 0 ->
                DraftUpdateResult.Updated(checkNotNull(findByIdInCurrentTransaction(team, id)))
            // Decided in the SAME transaction as the update: a concurrent
            // delete must classify as NotFound, never as a version conflict.
            findByIdInCurrentTransaction(team, id) == null -> DraftUpdateResult.NotFound
            else -> DraftUpdateResult.VersionConflict
        }
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
