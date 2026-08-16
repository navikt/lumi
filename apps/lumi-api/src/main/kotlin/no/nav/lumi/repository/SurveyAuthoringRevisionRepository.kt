package no.nav.lumi.repository

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import no.nav.lumi.domain.SurveyAuthoringRevision
import no.nav.lumi.domain.SurveyAuthoringRevisionDetail
import no.nav.lumi.domain.SurveyAuthoringRevisionSummary
import no.nav.lumi.domain.computeHash
import no.nav.lumi.validation.SurveyAuthoringDocumentValidator
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.util.UUID

sealed interface CreateSurveyAuthoringRevisionResult {
    data class Created(val revision: SurveyAuthoringRevision) : CreateSurveyAuthoringRevisionResult
    data object NotFound : CreateSurveyAuthoringRevisionResult
    data object DraftChanged : CreateSurveyAuthoringRevisionResult
    data object LimitReached : CreateSurveyAuthoringRevisionResult
    data class DefinitionConflict(val previousRevisionNumber: Long) : CreateSurveyAuthoringRevisionResult
}

class SurveyAuthoringRevisionRepository {
    private val json = Json

    suspend fun createFromDraft(
        team: String,
        projectId: UUID,
        expectedDraftVersion: Long,
        principalIdentity: String,
        maxRevisions: Long,
    ): CreateSurveyAuthoringRevisionResult = dbQuery {
        val connection = TransactionManager.current().connection.connection as Connection
        connection.prepareStatement("SELECT pg_advisory_xact_lock(hashtext(?))").use { lock ->
            lock.setString(1, "survey-authoring-revision:$projectId")
            lock.execute()
        }

        val projectRow = SurveyAuthoringProjectTable.selectAll()
            .where {
                (SurveyAuthoringProjectTable.id eq projectId) and
                    (SurveyAuthoringProjectTable.team eq team)
            }
            .singleOrNull()
            ?: return@dbQuery CreateSurveyAuthoringRevisionResult.NotFound

        val draftVersion = projectRow[SurveyAuthoringProjectTable.draftVersion]
        if (draftVersion != expectedDraftVersion) {
            return@dbQuery CreateSurveyAuthoringRevisionResult.DraftChanged
        }

        val document = json.parseToJsonElement(projectRow[SurveyAuthoringProjectTable.draft]) as JsonObject
        val surveyId = projectRow[SurveyAuthoringProjectTable.surveyId]
        val validated = SurveyAuthoringDocumentValidator.validate(document, surveyId, releaseGate = true)
        val definitionHash = validated.definition.computeHash()

        val previousRevisionNumber = SurveyAuthoringRevisionTable.selectAll()
            .where { SurveyAuthoringRevisionTable.projectId eq projectId }
            .orderBy(SurveyAuthoringRevisionTable.revisionNumber to SortOrder.DESC)
            .limit(1)
            .singleOrNull()
            ?.get(SurveyAuthoringRevisionTable.revisionNumber)
            ?: 0L
        if (previousRevisionNumber >= maxRevisions) {
            return@dbQuery CreateSurveyAuthoringRevisionResult.LimitReached
        }

        val previousForSurvey = SurveyAuthoringRevisionTable.selectAll()
            .where {
                (SurveyAuthoringRevisionTable.projectId eq projectId) and
                    (SurveyAuthoringRevisionTable.surveyId eq surveyId)
            }
            .orderBy(SurveyAuthoringRevisionTable.revisionNumber to SortOrder.DESC)
            .limit(1)
            .singleOrNull()
        if (
            previousForSurvey != null &&
            previousForSurvey[SurveyAuthoringRevisionTable.definitionHash] != definitionHash
        ) {
            return@dbQuery CreateSurveyAuthoringRevisionResult.DefinitionConflict(
                previousForSurvey[SurveyAuthoringRevisionTable.revisionNumber],
            )
        }

        val inserted = SurveyAuthoringRevisionTable.insert {
            it[SurveyAuthoringRevisionTable.projectId] = projectId
            it[revisionNumber] = previousRevisionNumber + 1
            it[SurveyAuthoringRevisionTable.draftVersion] = draftVersion
            it[name] = projectRow[SurveyAuthoringProjectTable.name]
            it[SurveyAuthoringRevisionTable.surveyId] = surveyId
            it[SurveyAuthoringRevisionTable.document] = document.toString()
            it[documentHash] = validated.documentHash
            it[definition] = json.encodeToString(validated.definition)
            it[SurveyAuthoringRevisionTable.definitionHash] = definitionHash
            it[createdBy] = principalIdentity
        }

        CreateSurveyAuthoringRevisionResult.Created(
            findByIdInCurrentTransaction(team, inserted[SurveyAuthoringRevisionTable.id])!!,
        )
    }

    suspend fun findByProject(
        team: String,
        projectId: UUID,
    ): List<SurveyAuthoringRevisionSummary>? = dbQuery {
        val projectExists = SurveyAuthoringProjectTable.selectAll()
            .where {
                (SurveyAuthoringProjectTable.id eq projectId) and
                    (SurveyAuthoringProjectTable.team eq team)
            }
            .limit(1)
            .any()
        if (!projectExists) return@dbQuery null

        SurveyAuthoringRevisionTable.selectAll()
            .where { SurveyAuthoringRevisionTable.projectId eq projectId }
            .orderBy(SurveyAuthoringRevisionTable.revisionNumber to SortOrder.DESC)
            .map(::toSummary)
    }

    suspend fun findDetailById(team: String, revisionId: UUID): SurveyAuthoringRevisionDetail? = dbQuery {
        val revision = findByIdInCurrentTransaction(team, revisionId) ?: return@dbQuery null
        val previous = SurveyAuthoringRevisionTable.selectAll()
            .where {
                (SurveyAuthoringRevisionTable.projectId eq UUID.fromString(revision.projectId)) and
                    (SurveyAuthoringRevisionTable.revisionNumber less revision.revisionNumber)
            }
            .orderBy(SurveyAuthoringRevisionTable.revisionNumber to SortOrder.DESC)
            .limit(1)
            .singleOrNull()
            ?.let(::toRevision)
        SurveyAuthoringRevisionDetail(revision = revision, previousRevision = previous)
    }

    private fun findByIdInCurrentTransaction(team: String, revisionId: UUID): SurveyAuthoringRevision? =
        (SurveyAuthoringRevisionTable innerJoin SurveyAuthoringProjectTable)
            .selectAll()
            .where {
                (SurveyAuthoringRevisionTable.id eq revisionId) and
                    (SurveyAuthoringProjectTable.team eq team)
            }
            .singleOrNull()
            ?.let(::toRevision)

    private fun toRevision(row: ResultRow) = SurveyAuthoringRevision(
        id = row[SurveyAuthoringRevisionTable.id].toString(),
        projectId = row[SurveyAuthoringRevisionTable.projectId].toString(),
        revisionNumber = row[SurveyAuthoringRevisionTable.revisionNumber],
        draftVersion = row[SurveyAuthoringRevisionTable.draftVersion],
        name = row[SurveyAuthoringRevisionTable.name],
        surveyId = row[SurveyAuthoringRevisionTable.surveyId],
        document = json.parseToJsonElement(row[SurveyAuthoringRevisionTable.document]) as JsonObject,
        documentHash = row[SurveyAuthoringRevisionTable.documentHash],
        definitionHash = row[SurveyAuthoringRevisionTable.definitionHash],
        createdBy = row[SurveyAuthoringRevisionTable.createdBy],
        createdAt = row[SurveyAuthoringRevisionTable.createdAt].toString(),
    )

    private fun toSummary(row: ResultRow) = SurveyAuthoringRevisionSummary(
        id = row[SurveyAuthoringRevisionTable.id].toString(),
        projectId = row[SurveyAuthoringRevisionTable.projectId].toString(),
        revisionNumber = row[SurveyAuthoringRevisionTable.revisionNumber],
        draftVersion = row[SurveyAuthoringRevisionTable.draftVersion],
        name = row[SurveyAuthoringRevisionTable.name],
        surveyId = row[SurveyAuthoringRevisionTable.surveyId],
        documentHash = row[SurveyAuthoringRevisionTable.documentHash],
        definitionHash = row[SurveyAuthoringRevisionTable.definitionHash],
        createdBy = row[SurveyAuthoringRevisionTable.createdBy],
        createdAt = row[SurveyAuthoringRevisionTable.createdAt].toString(),
    )
}
