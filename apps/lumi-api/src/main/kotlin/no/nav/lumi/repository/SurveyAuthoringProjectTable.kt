package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestampWithTimeZone

object SurveyAuthoringProjectTable : Table("survey_authoring_projects") {
    val id = javaUUID("id").autoGenerate()
    val team = varchar("team", 255)
    val name = varchar("name", 120)
    val surveyId = varchar("survey_id", 200)
    val draft = registerColumn<String>("draft", JsonbColumnType())
    val draftVersion = long("draft_version")
    val createdBy = text("created_by")
    val updatedBy = text("updated_by")
    val createdAt = timestampWithTimeZone("created_at")
    val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey = PrimaryKey(id)
}
