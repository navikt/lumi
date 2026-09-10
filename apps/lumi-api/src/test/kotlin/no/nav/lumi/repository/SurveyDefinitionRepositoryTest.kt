package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SurveyType
import java.sql.Timestamp
import java.time.Instant
import java.time.ZoneOffset

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
        val definition = stored.definition.shouldNotBeNull()
        definition.surveyType shouldBe SurveyType.RATING
        definition.fields.shouldHaveSize(1)
        definition.fields.single().fieldId shouldBe "comment"
        definition.fields.single().fieldType shouldBe FieldType.TEXT
    }

    test("stored submission moves activity and definition retention forward") {
        val oldActivity = Instant.parse("2020-01-01T00:00:00Z")
        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                    INSERT INTO survey_definitions (
                        team, survey_id, definition_hash, definition,
                        last_submission_at, definition_retention_at
                    )
                    VALUES ('team-a', 'survey-activity', ?, ?::jsonb, ?, ?)
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, "a".repeat(64))
                statement.setString(
                    2,
                    """{"surveyId":"survey-activity","surveyType":"custom","fields":[]}""",
                )
                statement.setTimestamp(3, Timestamp.from(oldActivity))
                statement.setTimestamp(4, Timestamp.from(oldActivity))
                statement.executeUpdate()
            }
            connection.commit()
        }
        dbQuery {
            repository.recordStoredSubmissionInCurrentTransaction("team-a", "survey-activity")
        }

        val stored = repository.findByTeamAndSurveyId("team-a", "survey-activity").shouldNotBeNull()
        (stored.lastSubmissionAt > oldActivity) shouldBe true
        (
            stored.definitionRetentionAt >= stored.lastSubmissionAt.atZone(ZoneOffset.UTC)
                .plusMonths(18)
                .toInstant()
        ) shouldBe true
    }

    test("feedback insert updates activity for writers from before retention tracking") {
        val oldActivity = Instant.parse("2020-01-01T00:00:00Z")
        val submissionTime = Instant.parse("2026-08-26T12:34:56Z")
        TestDatabase.dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                    INSERT INTO survey_definitions (
                        team, survey_id, definition_hash, definition,
                        last_submission_at, definition_retention_at
                    )
                    VALUES ('team-a', 'survey-rolling', ?, ?::jsonb, ?, ?)
                """.trimIndent()
            ).use { statement ->
                statement.setString(1, "a".repeat(64))
                statement.setString(
                    2,
                    """{"surveyId":"survey-rolling","surveyType":"custom","fields":[]}""",
                )
                statement.setTimestamp(3, Timestamp.from(oldActivity))
                statement.setTimestamp(4, Timestamp.from(oldActivity))
                statement.executeUpdate()
            }
            connection.prepareStatement(
                """
                    INSERT INTO feedback (id, opprettet, feedback_json, team, app, survey_id)
                    VALUES ('rolling-feedback', ?, '{}'::jsonb, 'team-a', 'app-a', 'survey-rolling')
                """.trimIndent()
            ).use { statement ->
                statement.setTimestamp(1, Timestamp.from(submissionTime))
                statement.executeUpdate()
            }
            connection.commit()
        }

        val stored = repository.findByTeamAndSurveyId("team-a", "survey-rolling").shouldNotBeNull()
        stored.lastSubmissionAt shouldBe submissionTime
        stored.definitionRetentionAt shouldBe submissionTime.atZone(ZoneOffset.UTC)
            .plusMonths(18)
            .toInstant()
    }
})
