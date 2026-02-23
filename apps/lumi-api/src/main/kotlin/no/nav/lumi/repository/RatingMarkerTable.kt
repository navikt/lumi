package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.date
import org.jetbrains.exposed.v1.javatime.timestampWithTimeZone

object RatingMarkerTable : Table("rating_marker") {
    val id = javaUUID("id").autoGenerate()
    val team = text("team")
    val surveyId = text("survey_id")
    val markerDate = date("marker_date")
    val label = varchar("label", 80)
    val description = varchar("description", 500).nullable()
    val color = varchar("color", 7).nullable()
    val createdBy = text("created_by").nullable()
    val createdAt = timestampWithTimeZone("created_at")
    val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey = PrimaryKey(id)
}
