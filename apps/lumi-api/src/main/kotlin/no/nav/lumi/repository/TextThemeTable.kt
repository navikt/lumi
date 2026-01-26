package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.java.javaUUID
import org.jetbrains.exposed.v1.javatime.timestampWithTimeZone

/**
 * Exposed table definition for text_theme table.
 * Used for grouping free-text responses by keyword matching.
 * Can be reused across all survey types (Rating, Discovery, TopTasks, etc.)
 */
object TextThemeTable : Table("text_theme") {
    val id = javaUUID("id").autoGenerate()
    val team = text("team")
    val name = text("name")
    val keywords = array<String>("keywords", TextColumnType())
    val color = text("color").nullable()
    val priority = integer("priority").default(0)
    val analysisContext = text("analysis_context")
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}
