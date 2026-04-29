package no.nav.lumi.repository

import org.jetbrains.exposed.v1.core.Table

object SurveyDefinitionTable : Table("survey_definitions") {
    val team = varchar("team", 255)
    val surveyId = varchar("survey_id", 255)
    val definitionHash = varchar("definition_hash", 64)
    val definition = registerColumn<String>("definition", JsonbColumnType())
}
