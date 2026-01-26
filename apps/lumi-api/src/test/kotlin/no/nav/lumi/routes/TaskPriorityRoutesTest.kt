package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.comparables.shouldBeGreaterThan
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
import no.nav.lumi.domain.TaskPriorityResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class TaskPriorityRoutesTest : FunSpec({

    val json = Json { ignoreUnknownKeys = true }

    /**
     * Creates JSON for a Task Priority survey response
     */
    fun taskPriorityJson(
        surveyId: String,
        selectedTaskIds: List<String>,
    ): String {
        val selectedIdsArray = selectedTaskIds.joinToString { "\"$it\"" }

        return """
            {
              "schemaVersion": 1,
              "surveyId": "$surveyId",
              "surveyType": "taskPriority",
              "context": {"deviceType": "desktop"},
              "answers": [
                {
                  "fieldId": "priority",
                  "fieldType": "MULTI_CHOICE",
                  "question": {
                    "label": "Hva er de viktigste tingene du trenger å gjøre på nav.no?",
                    "options": [
                      {"id": "sjekke-utbetaling", "label": "Sjekke utbetalinger"},
                      {"id": "sok-dagpenger", "label": "Søke dagpenger"},
                      {"id": "melde-sykefravaer", "label": "Melde sykefravær"},
                      {"id": "sjekke-status", "label": "Sjekke søknadsstatus"},
                      {"id": "meldekort", "label": "Sende meldekort"},
                      {"id": "finne-skjema", "label": "Finne riktig skjema"},
                      {"id": "kontakte-nav", "label": "Kontakte NAV"},
                      {"id": "lese-rettigheter", "label": "Lese om mine rettigheter"}
                    ]
                  },
                  "value": {"type": "multiChoice", "selectedOptionIds": [$selectedIdsArray]}
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

    test("GET /api/v1/intern/stats/task-priority returns vote counts per task") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority"

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            // Simulate votes: sjekke-utbetaling is most popular
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling", "sok-dagpenger")),
                opprettet = t0
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling", "sjekke-status")),
                opprettet = t0.plusMinutes(1)
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")),
                opprettet = t0.plusMinutes(2)
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")),
                opprettet = t0.plusMinutes(3)
            )
            // Add filler to avoid privacy masking (<5 total)
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = """
                    {
                      "schemaVersion": 1,
                      "surveyId": "$surveyId",
                      "surveyType": "rating",
                      "context": {"deviceType": "desktop"},
                      "answers": [
                        {
                          "fieldId": "rating",
                          "fieldType": "RATING",
                          "question": {"label": "Hvordan?"},
                          "value": {"type": "rating", "rating": 5}
                        }
                      ]
                    }
                """.trimIndent(),
                opprettet = t0.plusMinutes(4)
            )

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 4

            // sjekke-utbetaling should have 3 votes
            val topTask = stats.tasks.first { it.task == "Sjekke utbetalinger" }
            topTask.votes shouldBe 3

            // sok-dagpenger should have 2 votes
            val secondTask = stats.tasks.first { it.task == "Søke dagpenger" }
            secondTask.votes shouldBe 2

            // sjekke-status should have 1 vote
            val thirdTask = stats.tasks.first { it.task == "Sjekke søknadsstatus" }
            thirdTask.votes shouldBe 1
        }
    }

    test("GET /api/v1/intern/stats/task-priority calculates percentage distribution") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority-pct"

            val t0 = OffsetDateTime.now()

            // 10 votes total: 5 for task A, 3 for task B, 2 for task C
            repeat(5) {
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")),
                    opprettet = t0.plusMinutes(it.toLong())
                )
            }
            repeat(3) {
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")),
                    opprettet = t0.plusMinutes((5 + it).toLong())
                )
            }
            repeat(2) {
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = taskPriorityJson(surveyId, listOf("melde-sykefravaer")),
                    opprettet = t0.plusMinutes((8 + it).toLong())
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 10

            // Total votes = 5 + 3 + 2 = 10
            val topTask = stats.tasks.first { it.task == "Sjekke utbetalinger" }
            topTask.percentage shouldBe 50 // 5/10 = 50%

            val secondTask = stats.tasks.first { it.task == "Søke dagpenger" }
            secondTask.percentage shouldBe 30 // 3/10 = 30%
        }
    }

    test("GET /api/v1/intern/stats/task-priority calculates Long Neck cutoff") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority-longneck"

            val t0 = OffsetDateTime.now()

            // Create a distribution where top tasks account for 80%+
            // 6 votes for task A, 2 for task B, 1 for task C, 1 for task D = 10 total
            repeat(6) {
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")),
                    opprettet = t0.plusMinutes(it.toLong())
                )
            }
            repeat(2) {
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")),
                    opprettet = t0.plusMinutes((6 + it).toLong())
                )
            }
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("melde-sykefravaer")),
                opprettet = t0.plusMinutes(8)
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-status")),
                opprettet = t0.plusMinutes(9)
            )

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())

            // Long neck cutoff: index where cumulative hits 80%
            // Task A: 60%, cumulative = 60%
            // Task B: 20%, cumulative = 80% => cutoff at index 1 or 2
            stats.longNeckCutoff shouldBeGreaterThan 0
        }
    }

    test("GET /api/v1/intern/stats/task-priority sorts tasks by vote count descending") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority-sort"

            val t0 = OffsetDateTime.now()

            // Insert in random order but with clear vote counts
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("melde-sykefravaer")), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")), opprettet = t0.plusMinutes(2))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")), opprettet = t0.plusMinutes(3))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")), opprettet = t0.plusMinutes(4))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")), opprettet = t0.plusMinutes(5))

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())

            // Tasks should be sorted by votes descending
            stats.tasks[0].task shouldBe "Sjekke utbetalinger"
            stats.tasks[0].votes shouldBe 3

            stats.tasks[1].task shouldBe "Søke dagpenger"
            stats.tasks[1].votes shouldBe 2

            stats.tasks[2].task shouldBe "Melde sykefravær"
            stats.tasks[2].votes shouldBe 1
        }
    }

    test("GET /api/v1/intern/stats/task-priority is not masked at threshold") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority-threshold"

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")),
                opprettet = t0
            )
            repeat(4) { offset ->
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = """
                        {
                          "schemaVersion": 1,
                          "surveyId": "$surveyId",
                          "surveyType": "rating",
                          "context": {"deviceType": "desktop"},
                          "answers": [
                            {
                              "fieldId": "rating",
                              "fieldType": "RATING",
                              "question": {"label": "Hvordan?"},
                              "value": {"type": "rating", "rating": 5}
                            }
                          ]
                        }
                    """.trimIndent(),
                    opprettet = t0.plusMinutes((offset + 1).toLong())
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())
            stats.totalSubmissions shouldBe 1
            stats.tasks.size shouldBe 1
            stats.tasks.first().task shouldBe "Sjekke utbetalinger"
        }
    }

    test("GET /api/v1/intern/stats/task-priority returns cumulative percentage at top 5") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-priority-cum5"

            val t0 = OffsetDateTime.now()

            // Create votes for 6 different tasks
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-utbetaling")), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sok-dagpenger")), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("melde-sykefravaer")), opprettet = t0.plusMinutes(2))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("sjekke-status")), opprettet = t0.plusMinutes(3))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("meldekort")), opprettet = t0.plusMinutes(4))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = taskPriorityJson(surveyId, listOf("finne-skjema")), opprettet = t0.plusMinutes(5))

            val response = createTestClient().get("/api/v1/intern/stats/task-priority?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<TaskPriorityResponse>(response.bodyAsText())

            // With 6 tasks of 1 vote each, top 5 = 5/6 = 83%
            stats.cumulativePercentageAt5 shouldBeGreaterThan 0
        }
    }
})
