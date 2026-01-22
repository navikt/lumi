package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.BlockerStatsResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class BlockerRoutesTest : FunSpec({

    val json = Json { ignoreUnknownKeys = true }

    fun topTasksJsonWithBlocker(
        surveyId: String,
        selectedTaskId: String,
        taskLabel: String,
        success: String, // "yes", "partial", "no"
        blocker: String?,
    ): String {
        val blockerAnswer = if (blocker != null) {
            """
            ,{
              "fieldId": "blocker",
              "fieldType": "TEXT",
              "question": {"label": "Hva hindret deg?"},
              "value": {"type": "text", "text": "$blocker"}
            }
            """.trimIndent()
        } else {
            ""
        }

        return """
            {
              "schemaVersion": 1,
              "surveyId": "$surveyId",
              "surveyType": "topTasks",
              "context": {"deviceType": "desktop"},
              "answers": [
                {
                  "fieldId": "task",
                  "fieldType": "SINGLE_CHOICE",
                  "question": {
                    "label": "Hva prøvde du å gjøre?",
                    "options": [
                      {"id": "$selectedTaskId", "label": "$taskLabel"}
                    ]
                  },
                  "value": {"type": "singleChoice", "selectedOptionId": "$selectedTaskId"}
                },
                {
                  "fieldId": "taskSuccess",
                  "fieldType": "SINGLE_CHOICE",
                  "question": {
                    "label": "Klarte du det?",
                    "options": [
                      {"id": "yes", "label": "Ja"},
                      {"id": "partial", "label": "Delvis"},
                      {"id": "no", "label": "Nei"}
                    ]
                  },
                  "value": {"type": "singleChoice", "selectedOptionId": "$success"}
                }
                $blockerAnswer
              ]
            }
        """.trimIndent()
    }

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/stats/blockers returns blocker stats for top tasks") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-blockers"

            val t0 = OffsetDateTime.parse("2026-01-21T10:00:00+01:00")

            // 2 blockers + 1 without blocker
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = topTasksJsonWithBlocker(
                    surveyId = surveyId,
                    selectedTaskId = "task-a",
                    taskLabel = "Lage oppfølgingsplan",
                    success = "no",
                    blocker = "Fant ikke skjema",
                ),
                opprettet = t0,
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = topTasksJsonWithBlocker(
                    surveyId = surveyId,
                    selectedTaskId = "task-a",
                    taskLabel = "Lage oppfølgingsplan",
                    success = "no",
                    blocker = "Teknisk feil i skjema",
                ),
                opprettet = t0.plusMinutes(1),
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = topTasksJsonWithBlocker(
                    surveyId = surveyId,
                    selectedTaskId = "task-a",
                    taskLabel = "Lage oppfølgingsplan",
                    success = "yes",
                    blocker = null,
                ),
                opprettet = t0.plusMinutes(2),
            )

            val response = createTestClient().get(
                "/api/v1/intern/stats/blockers?team=$team&app=$app&surveyId=$surveyId",
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<BlockerStatsResponse>(response.bodyAsText())

            stats.totalBlockers shouldBe 2
            stats.wordFrequency shouldHaveAtLeastSize 1
            stats.recentBlockers shouldHaveAtLeastSize 1
        }
    }
})
