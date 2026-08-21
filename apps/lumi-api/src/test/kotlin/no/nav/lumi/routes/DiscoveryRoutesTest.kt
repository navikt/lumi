package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.DiscoveryStatsResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.insertTestTheme
import no.nav.lumi.testModule
import java.time.OffsetDateTime
import java.util.UUID

class DiscoveryRoutesTest : FunSpec({

    val json = Json { ignoreUnknownKeys = true }

    /**
     * Creates JSON for a Discovery survey response
     */
    fun discoveryJson(
        surveyId: String,
        taskText: String,
        success: String, // "yes", "partial", "no"
        blocker: String? = null,
    ): String {
        val blockerAnswer = if (blocker != null) """
            ,{
              "fieldId": "blocker",
              "fieldType": "TEXT",
              "question": {"label": "Hva hindret deg?"},
              "value": {"type": "text", "text": "$blocker"}
            }
        """.trimIndent() else ""

        return """
            {
              "schemaVersion": 1,
              "surveyId": "$surveyId",
              "surveyType": "discovery",
              "context": {"deviceType": "desktop"},
              "answers": [
                {
                  "fieldId": "task",
                  "fieldType": "TEXT",
                  "question": {"label": "Hva kom du for å gjøre i dag?"},
                  "value": {"type": "text", "text": "$taskText"}
                },
                {
                  "fieldId": "success",
                  "fieldType": "SINGLE_CHOICE",
                  "question": {
                    "label": "Fikk du gjort det?",
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

    test("GET /api/v1/intern/stats/discovery returns phrase and theme insights") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-discovery"

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            // Insert discovery responses
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = discoveryJson(surveyId, "Sjekke sykepenger status", "yes"),
                opprettet = t0
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = discoveryJson(surveyId, "Sjekke utbetaling status", "yes"),
                opprettet = t0.plusMinutes(1)
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = discoveryJson(surveyId, "Lese om dagpenger", "partial"),
                opprettet = t0.plusMinutes(2)
            )

            val response = createTestClient().get("/api/v1/intern/stats/discovery?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<DiscoveryStatsResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 3

            // Recent responses should be included
            stats.recentResponses shouldHaveAtLeastSize 1
        }
    }

    test("GET /api/v1/intern/stats/discovery groups responses by themes") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-discovery-themes"

            // Create themes for matching
            insertTestTheme(
                team = team,
                name = "Sykepenger",
                keywords = listOf("sykepenger"),
                color = "var(--ax-status-success)",
                analysisContext = "GENERAL_FEEDBACK"
            )
            insertTestTheme(
                team = team,
                name = "Dagpenger",
                keywords = listOf("dagpenger"),
                color = "var(--ax-status-info)",
                analysisContext = "GENERAL_FEEDBACK"
            )

            val t0 = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")

            // Sykepenger theme: 2 success, 1 failure
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Sjekke sykepenger", "yes"), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Søke sykepenger", "yes"), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Finne info om sykepenger", "no", blocker = "Fant ikke siden"), opprettet = t0.plusMinutes(2))

            // Dagpenger theme: 1 success
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Søke dagpenger", "yes"), opprettet = t0.plusMinutes(3))

            val response = createTestClient().get("/api/v1/intern/stats/discovery?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<DiscoveryStatsResponse>(response.bodyAsText())

            stats.totalSubmissions shouldBe 4

            // Themes should be populated
            val sykepengerTheme = stats.themes.find { it.theme == "Sykepenger" }
            sykepengerTheme shouldNotBe null
            sykepengerTheme?.count shouldBe 3
            // Success rate: 2/3 = 0.667
            sykepengerTheme?.successRate shouldBe (2.0 / 3.0)

            val dagpengerTheme = stats.themes.find { it.theme == "Dagpenger" }
            dagpengerTheme shouldNotBe null
            dagpengerTheme?.count shouldBe 1
            dagpengerTheme?.successRate shouldBe 1.0
        }
    }

    test("GET /api/v1/intern/stats/discovery filters by date range") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-discovery-dates"

            val inRange = OffsetDateTime.parse("2025-01-15T10:00:00+01:00")
            val outOfRange = OffsetDateTime.parse("2025-01-20T10:00:00+01:00")

            // In range
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Task 1", "yes"), opprettet = inRange)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Task 2", "yes"), opprettet = inRange.plusHours(1))

            // Out of range
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Task 3", "yes"), opprettet = outOfRange)

            val response = createTestClient().get("/api/v1/intern/stats/discovery?team=$team&app=$app&surveyId=$surveyId&fromDate=2025-01-15&toDate=2025-01-15") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<DiscoveryStatsResponse>(response.bodyAsText())

            // Only 2 should be in range
            stats.totalSubmissions shouldBe 2
        }
    }

    test("reserves Annet for the catch-all theme on create and update") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val createResponse = client.post("/api/v1/intern/themes") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """{"name":" annet ","keywords":["hjelp"],"analysisContext":"GENERAL_FEEDBACK"}"""
                )
            }
            createResponse.status shouldBe HttpStatusCode.BadRequest

            val themeId = insertTestTheme(
                team = "team-test",
                name = "Hjelp",
                keywords = listOf("hjelp"),
                analysisContext = "GENERAL_FEEDBACK",
            )
            val updateResponse = client.put("/api/v1/intern/themes/$themeId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """{"name":"ANNET","analysisContext":"GENERAL_FEEDBACK"}"""
                )
            }
            updateResponse.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("returns standard conflicts for duplicate theme names on create and update") {
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val suffix = UUID.randomUUID().toString().take(8)
            val existingName = "Søknad-$suffix"
            insertTestTheme(
                team = "team-test",
                name = existingName,
                keywords = listOf("søknad"),
                analysisContext = "GENERAL_FEEDBACK",
            )
            val otherThemeId = insertTestTheme(
                team = "team-test",
                name = "Utbetaling-$suffix",
                keywords = listOf("utbetaling"),
                analysisContext = "GENERAL_FEEDBACK",
            )

            val createResponse = client.post("/api/v1/intern/themes?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """{"name":"$existingName","keywords":["skjema"],"analysisContext":"GENERAL_FEEDBACK"}"""
                )
            }
            createResponse.status shouldBe HttpStatusCode.Conflict
            createResponse.bodyAsText().contains("\"type\":\"CONFLICT\"") shouldBe true

            val updateResponse = client.put("/api/v1/intern/themes/$otherThemeId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody(
                    """{"name":"$existingName","analysisContext":"GENERAL_FEEDBACK"}"""
                )
            }
            updateResponse.status shouldBe HttpStatusCode.Conflict
            updateResponse.bodyAsText().contains("\"type\":\"CONFLICT\"") shouldBe true
        }
    }
})
