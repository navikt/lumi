package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

object SurveyDefinitionTable : Table("survey_definitions") {
    val team = varchar("team", 255)
    val surveyId = varchar("survey_id", 255)
    val definitionHash = varchar("definition_hash", 64)
    val definition = registerColumn<String>("definition", JsonbColumnType())
    // Additional columns declared for schema completeness.
    // Defaults are managed by the DB (V12 migration); writes use defaults.
    val dbSource = varchar("source", 50).default("auto")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
}
