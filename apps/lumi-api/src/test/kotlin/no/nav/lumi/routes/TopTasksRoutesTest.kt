package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.doubles.plusOrMinus
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
import no.nav.lumi.domain.TopTasksResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class TopTasksRoutesTest : FunSpec({

    val json = Json { ignoreUnknownKeys = true }

    /**
     * Creates JSON for a Top Tasks survey response
     */
    fun topTasksJson(
        surveyId: String,
        selectedTaskId: String,
        taskLabel: String,
        success: String, // "yes", "partial", "no"
        blocker: String? = null,
        durationMs: Long? = null,
    ): String {
        val blockerAnswer = if (blocker != null) """
            ,{
              "fieldId": "blocker",
              "fieldType": "TEXT",
              "question": {"label": "Hva hindret deg?"},
              "value": {"type": "text", "text": "$blocker"}
            }
        """.trimIndent() else ""

        val durationField = if (durationMs != null) """
            "timeToCompleteMs": $durationMs,
        """.trimIndent() else ""

        return """
            {
              "schemaVersion": 1,
              "surveyId": "$surveyId",
              "surveyType": "topTasks",
              $durationField
              "context": {"deviceType": "desktop"},
              "answers": [
                {
                  "fieldId": "task",
                  "fieldType": "SINGLE_CHOICE",
                  "question": {
                    "label": "Hva prøvde du å gjøre?",
                    "options": [
                      {"id": "task-a", "label": "Lage oppfølgingsplan"},
                      {"id": "task-b", "label": "Se innkalling"},
                      {"id": "task-c", "label": "Svare på møte"}
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

    fun ratingJson(surveyId: String, contextTagsJson: String? = null): String {
        val tagsBlock = if (contextTagsJson != null) """"tags": $contextTagsJson, """ else ""
        return """
            {
              "schemaVersion": 1,
              "surveyId": "$surveyId",
              "surveyType": "rating",
              "context": { $tagsBlock"deviceType": "desktop" },
              "answers": [
                {
                  "fieldId": "rating",
                  "fieldType": "RATING",
                  "question": {"label": "Hvordan?"},
                  "value": {"type": "rating", "rating": 5}
                }
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

    test("GET /api/v1/intern/stats/top-tasks returns task stats with success rates") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-tasks"

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            // Task A: 3 submissions - 2 success, 1 failure => 66.7% success rate
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "no", blocker = "Skjema feiler"), opprettet = t0.plusMinutes(2))

            // Task B: 2 submissions - 1 success, 1 partial => 50% success rate (partial counts as 0.5)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-b", "Se innkalling", "yes"), opprettet = t0.plusMinutes(3))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-b", "Se innkalling", "partial", blocker = "Treg lasting"), opprettet = t0.plusMinutes(4))

            val response = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TopTasksResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 5

            // Task A should have 3 total, 2 success, 1 failure
            val taskA = stats.tasks.first { it.task == "Lage oppfølgingsplan" }
            taskA.totalCount shouldBe 3
            taskA.successCount shouldBe 2
            taskA.failureCount shouldBe 1
            taskA.successRate shouldBe (0.667 plusOrMinus 0.01)

            // Task B should have 2 total, 1 success, 1 partial
            val taskB = stats.tasks.first { it.task == "Se innkalling" }
            taskB.totalCount shouldBe 2
            taskB.successCount shouldBe 1
            taskB.partialCount shouldBe 1
        }
    }

    test("GET /api/v1/intern/stats/top-tasks filters by task parameter") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-filter"

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            // Multiple tasks
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-b", "Se innkalling", "yes"), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "no", blocker = "Feil"), opprettet = t0.plusMinutes(2))
            // Add fillers to avoid privacy masking (<5 total)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = ratingJson(surveyId), opprettet = t0.plusMinutes(3))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = ratingJson(surveyId), opprettet = t0.plusMinutes(4))

            // Get all tasks first
            val allResponse = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            allResponse.status shouldBe HttpStatusCode.OK
            val allStats = json.decodeFromString<TopTasksResponse>(allResponse.bodyAsText())
            allStats.tasks.size shouldBe 2

            // Filter by specific task
            val filteredResponse = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId&task=Lage%20oppf%C3%B8lgingsplan") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            filteredResponse.status shouldBe HttpStatusCode.OK
            val filteredStats = json.decodeFromString<TopTasksResponse>(filteredResponse.bodyAsText())

            filteredStats.tasks.size shouldBe 1
            filteredStats.tasks[0].task shouldBe "Lage oppfølgingsplan"
            filteredStats.tasks[0].totalCount shouldBe 2
        }
    }

    test("GET /api/v1/intern/stats/top-tasks includes daily stats breakdown") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-daily"

            val day1 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")
            val day2 = OffsetDateTime.parse("2025-01-16T10:00:00+01:00")

            // Day 1: 2 submissions
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"), opprettet = day1)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "no"), opprettet = day1.plusMinutes(1))

            // Day 2: 1 submission
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"), opprettet = day2)
            // Add fillers to avoid privacy masking (<5 total)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = ratingJson(surveyId), opprettet = day2.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = ratingJson(surveyId), opprettet = day2.plusMinutes(2))

            val response = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val stats = json.decodeFromString<TopTasksResponse>(response.bodyAsText())

            stats.dailyStats.keys shouldContain "2025-01-15"
            stats.dailyStats.keys shouldContain "2025-01-16"

            stats.dailyStats["2025-01-15"]?.total shouldBe 2
            stats.dailyStats["2025-01-15"]?.success shouldBe 1
            stats.dailyStats["2025-01-16"]?.total shouldBe 1
            stats.dailyStats["2025-01-16"]?.success shouldBe 1
        }
    }

    test("GET /api/v1/intern/stats/top-tasks returns question text from survey") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-question"

            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"),
                opprettet = OffsetDateTime.now()
            )
            // Add fillers to avoid privacy masking (<5 total)
            repeat(4) { offset ->
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = ratingJson(surveyId),
                    opprettet = OffsetDateTime.now().plusMinutes((offset + 1).toLong())
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val stats = json.decodeFromString<TopTasksResponse>(response.bodyAsText())

            stats.questionText shouldBe "Hva prøvde du å gjøre?"
        }
    }

    test("GET /api/v1/intern/stats/top-tasks is not masked at threshold") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-threshold"

            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = topTasksJson(surveyId, "task-a", "Lage oppfølgingsplan", "yes"),
                opprettet = OffsetDateTime.now()
            )
            repeat(4) { offset ->
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = ratingJson(surveyId),
                    opprettet = OffsetDateTime.now().plusMinutes((offset + 1).toLong())
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val stats = json.decodeFromString<TopTasksResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 1
            stats.questionText shouldBe "Hva prøvde du å gjøre?"
        }
    }

    test("GET /api/v1/intern/stats/top-tasks supports segment filtering") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-top-segment"

            val t0 = OffsetDateTime.now()

            // With segment: abTest = A
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = """
                    {
                      "schemaVersion": 1,
                      "surveyId": "$surveyId",
                      "surveyType": "topTasks",
                      "context": {
                        "deviceType": "desktop",
                        "tags": {"abTest": "A"}
                      },
                      "answers": [
                        {"fieldId": "task", "fieldType": "SINGLE_CHOICE", "question": {"label": "Hva?"}, "value": {"type": "singleChoice", "selectedOptionId": "a"}},
                        {"fieldId": "taskSuccess", "fieldType": "SINGLE_CHOICE", "question": {"label": "Klarte du det?"}, "value": {"type": "singleChoice", "selectedOptionId": "yes"}}
                      ]
                    }
                """.trimIndent(),
                opprettet = t0
            )

            // With segment: abTest = B
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = """
                    {
                      "schemaVersion": 1,
                      "surveyId": "$surveyId",
                      "surveyType": "topTasks",
                      "context": {
                        "deviceType": "desktop",
                        "tags": {"abTest": "B"}
                      },
                      "answers": [
                        {"fieldId": "task", "fieldType": "SINGLE_CHOICE", "question": {"label": "Hva?"}, "value": {"type": "singleChoice", "selectedOptionId": "b"}},
                        {"fieldId": "taskSuccess", "fieldType": "SINGLE_CHOICE", "question": {"label": "Klarte du det?"}, "value": {"type": "singleChoice", "selectedOptionId": "yes"}}
                      ]
                    }
                """.trimIndent(),
                opprettet = t0.plusMinutes(1)
            )
            // Add fillers matching segment to avoid privacy masking (<5 total)
            repeat(4) { offset ->
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = ratingJson(surveyId, contextTagsJson = """{"abTest": "A"}"""),
                    opprettet = t0.plusMinutes((2 + offset).toLong())
                )
            }

            // Filter by segment
            val response = createTestClient().get("/api/v1/intern/stats/top-tasks?team=$team&app=$app&surveyId=$surveyId&segment=abTest:A") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val stats = json.decodeFromString<TopTasksResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 1
        }
    }
})
