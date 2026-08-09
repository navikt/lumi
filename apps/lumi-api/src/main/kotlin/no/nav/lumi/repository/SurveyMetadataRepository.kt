package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import java.sql.Connection
import java.time.OffsetDateTime

/**
 * Archive state for a survey as seen by the dashboard.
 * `archivedAt == null` means the survey is active (row kept after unarchive).
 */
@kotlinx.serialization.Serializable
data class SurveyArchiveState(
    val surveyId: String,
    val archivedAt: String?,
    val archivedBy: String?,
)

class SurveyMetadataRepository {
    /**
     * Archive a survey (upsert). Idempotent: re-archiving an already archived
     * survey keeps the original archived_at/archived_by, so the badge condition
     * (lastSubmissionAt > archivedAt) cannot be reset by repeated clicks.
     */
    suspend fun archive(team: String, surveyId: String, archivedBy: String?): SurveyArchiveState {
        return dbQuery {
            val conn = TransactionManager.current().connection.connection as Connection

            val sql = """
                INSERT INTO survey_metadata (team, survey_id, archived_at, archived_by)
                VALUES (?, ?, now(), ?)
                ON CONFLICT (team, survey_id) DO UPDATE SET
                    archived_at = COALESCE(survey_metadata.archived_at, EXCLUDED.archived_at),
                    archived_by = CASE
                        WHEN survey_metadata.archived_at IS NULL THEN EXCLUDED.archived_by
                        ELSE survey_metadata.archived_by
                    END,
                    updated_at = now()
                RETURNING survey_id, archived_at, archived_by
            """.trimIndent()

            conn.prepareStatement(sql).use { stmt ->
                stmt.setString(1, team)
                stmt.setString(2, surveyId)
                stmt.setString(3, archivedBy)
                stmt.executeQuery().use { rs ->
                    rs.next()
                    SurveyArchiveState(
                        surveyId = rs.getString("survey_id"),
                        archivedAt = rs.getObject("archived_at", OffsetDateTime::class.java)?.toString(),
                        archivedBy = rs.getString("archived_by"),
                    )
                }
            }
        }
    }

    /**
     * Restore a survey. Clears archive state but keeps the row.
     * Returns false when the survey was not archived (no change).
     */
    suspend fun unarchive(team: String, surveyId: String): Boolean {
        return dbQuery {
            SurveyMetadataTable.update({
                (SurveyMetadataTable.team eq team) and
                    (SurveyMetadataTable.surveyId eq surveyId) and
                    SurveyMetadataTable.archivedAt.isNotNull()
            }) {
                it[SurveyMetadataTable.archivedAt] = null
                it[SurveyMetadataTable.archivedBy] = null
                it[SurveyMetadataTable.updatedAt] = OffsetDateTime.now()
            } > 0
        }
    }

    suspend fun findByTeam(team: String): List<SurveyArchiveState> {
        return dbQuery {
            SurveyMetadataTable.selectAll()
                .where { SurveyMetadataTable.team eq team }
                .orderBy(SurveyMetadataTable.surveyId to SortOrder.ASC)
                .map { row ->
                    SurveyArchiveState(
                        surveyId = row[SurveyMetadataTable.surveyId],
                        archivedAt = row[SurveyMetadataTable.archivedAt]?.toString(),
                        archivedBy = row[SurveyMetadataTable.archivedBy],
                    )
                }
        }
    }
}
