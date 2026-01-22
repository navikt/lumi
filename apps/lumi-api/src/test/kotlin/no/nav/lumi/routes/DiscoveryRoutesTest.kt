package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.DiscoveryStatsResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.insertTestTheme
import no.nav.lumi.testModule
import java.time.OffsetDateTime

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

    test("GET /api/v1/intern/stats/discovery returns discovery stats with word frequency") {
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

            // Word frequency should contain common words
            stats.wordFrequency shouldHaveAtLeastSize 1

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

    test("GET /api/v1/intern/stats/discovery includes stem and variants in word frequency") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-discovery-stems"

            val t0 = OffsetDateTime.now()

            // Multiple forms of the same word
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Søknaden min status", "yes"), opprettet = t0)
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Se søknad status", "yes"), opprettet = t0.plusMinutes(1))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = discoveryJson(surveyId, "Søknadene mine", "partial"), opprettet = t0.plusMinutes(2))

            val response = createTestClient().get("/api/v1/intern/stats/discovery?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<DiscoveryStatsResponse>(response.bodyAsText())

            // Should group søknaden, søknad, søknadene under same stem
            val søknadEntry = stats.wordFrequency.find { it.stem == "søknad" || it.word.startsWith("søknad") }
            søknadEntry shouldNotBe null
            // Variants should contain different forms
            søknadEntry?.variants?.isEmpty() shouldBe false
        }
    }

    test("GET /api/v1/intern/stats/discovery includes source responses for context") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-discovery-sources"

            val t0 = OffsetDateTime.now()

            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = discoveryJson(surveyId, "Sjekke status på saken min", "yes"),
                opprettet = t0
            )

            val response = createTestClient().get("/api/v1/intern/stats/discovery?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<DiscoveryStatsResponse>(response.bodyAsText())

            // Word frequency entries should have source responses
            val entryWithSources = stats.wordFrequency.find { it.sourceResponses.isNotEmpty() }
            entryWithSources shouldNotBe null
            entryWithSources?.sourceResponses?.first()?.text shouldNotBe null
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
})
