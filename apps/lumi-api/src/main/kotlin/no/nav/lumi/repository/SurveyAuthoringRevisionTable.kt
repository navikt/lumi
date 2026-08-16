package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestampWithTimeZone

object SurveyAuthoringRevisionTable : Table("survey_authoring_revisions") {
    val id = javaUUID("id").autoGenerate()
    val projectId = reference("project_id", SurveyAuthoringProjectTable.id)
    val revisionNumber = long("revision_number")
    val draftVersion = long("draft_version")
    val name = varchar("name", 120)
    val surveyId = varchar("survey_id", 200)
    val document = registerColumn<String>("document", JsonbColumnType())
    val documentHash = varchar("document_hash", 64)
    val definition = registerColumn<String>("definition", JsonbColumnType())
    val definitionHash = varchar("definition_hash", 64)
    val createdBy = text("created_by")
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}
