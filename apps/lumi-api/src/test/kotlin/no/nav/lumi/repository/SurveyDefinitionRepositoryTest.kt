package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SurveyType

class SurveyDefinitionRepositoryTest : FunSpec({
    val repository = SurveyDefinitionRepository()

    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("ignores unknown fields when reading stored definitions") {
        val definitionJson = """
            {
              "surveyId": "survey-unknown-fields",
              "surveyType": "rating",
              "unknownTopLevel": "future-value",
              "fields": [
                {
                  "fieldId": "comment",
                  "fieldType": "TEXT",
                  "ratingVariant": null,
                  "ratingScale": null,
                  "optionIds": null,
                  "futureField": "future-value"
                }
              ]
            }
        """.trimIndent()

        TestDatabase.dataSource.connection.use { conn ->
            conn.prepareStatement(
                """
                    INSERT INTO survey_definitions (team, survey_id, definition_hash, definition)
                    VALUES (?, ?, ?, ?::jsonb)
                """.trimIndent()
            ).use { stmt ->
                stmt.setString(1, "team-a")
                stmt.setString(2, "survey-unknown-fields")
                stmt.setString(3, "a".repeat(64))
                stmt.setString(4, definitionJson)
                stmt.executeUpdate()
            }
            conn.commit()
        }

        val stored = repository.findByTeamAndSurveyId("team-a", "survey-unknown-fields").shouldNotBeNull()
        stored.definition.surveyType shouldBe SurveyType.RATING
        stored.definition.fields.shouldHaveSize(1)
        stored.definition.fields.single().fieldId shouldBe "comment"
        stored.definition.fields.single().fieldType shouldBe FieldType.TEXT
    }
})
