package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestampWithTimeZone

object SurveyMetadataTable : Table("survey_metadata") {
    val id = javaUUID("id").autoGenerate()
    val team = varchar("team", 255)
    val surveyId = varchar("survey_id", 255)
    val archivedAt = timestampWithTimeZone("archived_at").nullable()
    val archivedBy = text("archived_by").nullable()
    val createdAt = timestampWithTimeZone("created_at")
    val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey = PrimaryKey(id)
}
