package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.QuestionTrendResponse
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class QuestionTrendRoutesTest : FunSpec({
    val json = Json { ignoreUnknownKeys = true }

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    test("question trend requires authentication and authorized team scope") {
        testApplication {
            application { testModule() }

            client.get(
                "/api/v1/intern/stats/question-trend?surveyId=survey-a&fieldId=score"
            ).status shouldBe HttpStatusCode.Unauthorized

            createTestClient().get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=unauthorized-team&surveyId=survey-a&fieldId=score"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.Forbidden
        }
    }

    test("rating trend aggregates in PostgreSQL and honors active filters") {
        testApplication {
            application { testModule() }
            val baseTime = OffsetDateTime.parse("2026-01-07T12:00:00+01:00")

            listOf(1, 2, 3, 4, 5).forEachIndexed { index, rating ->
                insertTrendFeedback(
                    id = "matching-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = baseTime.plusMinutes(index.toLong()),
                    score = rating,
                )
            }

            val distractors = listOf(
                TrendOverrides(team = "team-b"),
                TrendOverrides(app = "app-b"),
                TrendOverrides(surveyId = "survey-b"),
                TrendOverrides(deviceType = "mobile"),
                TrendOverrides(segmentValue = "arbeidstaker"),
                TrendOverrides(gateRating = 4),
                TrendOverrides(gateChoice = "no"),
                TrendOverrides(task = "task-b"),
            )
            distractors.forEachIndexed { index, override ->
                insertTrendFeedback(
                    id = "distractor-$index",
                    team = override.team,
                    app = override.app,
                    surveyId = override.surveyId,
                    submittedAt = baseTime,
                    score = 5,
                    deviceType = override.deviceType,
                    segmentValue = override.segmentValue,
                    gateRating = override.gateRating,
                    gateChoice = override.gateChoice,
                    task = override.task,
                )
            }

            val response = createTestClient().get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=flex&app=app-a&surveyId=survey-a" +
                    "&fromDate=2026-01-01&toDate=2026-01-31" +
                    "&deviceType=desktop&segment=rolle:arbeidsgiver" +
                    "&rating=gate-rating:5&choice=gate-choice:yes&task=task-a" +
                    "&fieldId=score&interval=week"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val trend = json.decodeFromString<QuestionTrendResponse>(response.bodyAsText())
            trend.fieldType shouldBe FieldType.RATING
            trend.label shouldBe "Hvor fornøyd er du?"
            trend.buckets.size shouldBe 1
            trend.buckets.single().startDate shouldBe "2026-01-05"
            trend.buckets.single().responseCount shouldBe 5
            trend.buckets.single().average!! shouldBe (3.0 plusOrMinus 0.001)
        }
    }

    test("choice trends use respondents as denominator for single and multiple choice") {
        testApplication {
            application { testModule() }
            val baseTime = OffsetDateTime.parse("2026-02-10T12:00:00+01:00")

            repeat(5) { index ->
                insertTrendFeedback(
                    id = "choice-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = baseTime.plusMinutes(index.toLong()),
                    score = 4,
                    singleChoice = if (index < 3) "a" else "b",
                    multiChoice = if (index < 3) listOf("a", "b") else listOf("b"),
                )
            }

            suspend fun fetch(fieldId: String): QuestionTrendResponse {
                val response = createTestClient().get(
                    "/api/v1/intern/stats/question-trend" +
                        "?team=flex&app=app-a&surveyId=survey-a" +
                        "&fromDate=2026-02-01&toDate=2026-02-28" +
                        "&fieldId=$fieldId&interval=month"
                ) {
                    header(HttpHeaders.Authorization, "Bearer test-token")
                }
                response.status shouldBe HttpStatusCode.OK
                return json.decodeFromString(response.bodyAsText())
            }

            val single = fetch("single")
            single.fieldType shouldBe FieldType.SINGLE_CHOICE
            single.options.map { it.id } shouldBe listOf("a", "b", "c")
            single.buckets.single().distribution["a"]?.count shouldBe 3
            single.buckets.single().distribution["a"]?.percentage shouldBe 60.0
            single.buckets.single().distribution["b"]?.count shouldBe 2
            single.buckets.single().distribution["c"]?.count shouldBe 0

            val multiple = fetch("multiple")
            multiple.fieldType shouldBe FieldType.MULTI_CHOICE
            multiple.buckets.single().responseCount shouldBe 5
            multiple.buckets.single().distribution["a"]?.percentage shouldBe 60.0
            multiple.buckets.single().distribution["b"]?.percentage shouldBe 100.0
        }
    }

    test("question trend masks each interval independently") {
        testApplication {
            application { testModule() }
            val january = OffsetDateTime.parse("2026-01-10T12:00:00+01:00")
            val february = OffsetDateTime.parse("2026-02-10T12:00:00+01:00")

            repeat(4) { index ->
                insertTrendFeedback(
                    id = "masked-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = january.plusMinutes(index.toLong()),
                    score = 1,
                )
            }
            repeat(5) { index ->
                insertTrendFeedback(
                    id = "visible-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = february.plusMinutes(index.toLong()),
                    score = 5,
                )
            }

            val response = createTestClient().get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=flex&app=app-a&surveyId=survey-a" +
                    "&fromDate=2026-01-01&toDate=2026-02-28" +
                    "&fieldId=score&interval=month"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val buckets = json.decodeFromString<QuestionTrendResponse>(response.bodyAsText()).buckets
            buckets.map { it.startDate } shouldBe listOf("2026-01-01", "2026-02-01")
            buckets[0].masked shouldBe true
            buckets[0].responseCount shouldBe null
            buckets[0].average shouldBe null
            buckets[1].masked shouldBe false
            buckets[1].responseCount shouldBe 5
            buckets[1].average shouldBe 5.0
        }
    }

    test("day intervals follow Europe Oslo calendar boundaries") {
        testApplication {
            application { testModule() }

            repeat(5) { index ->
                insertTrendFeedback(
                    id = "oslo-before-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = OffsetDateTime.parse("2026-01-01T22:30:00Z").plusMinutes(index.toLong()),
                    score = 3,
                )
                insertTrendFeedback(
                    id = "oslo-after-$index",
                    team = "flex",
                    app = "app-a",
                    surveyId = "survey-a",
                    submittedAt = OffsetDateTime.parse("2026-01-01T23:30:00Z").plusMinutes(index.toLong()),
                    score = 5,
                )
            }

            val response = createTestClient().get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=flex&app=app-a&surveyId=survey-a" +
                    "&fromDate=2026-01-01&toDate=2026-01-02" +
                    "&fieldId=score&interval=day"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val buckets = json.decodeFromString<QuestionTrendResponse>(response.bodyAsText()).buckets
            buckets.map { it.startDate } shouldBe listOf("2026-01-01", "2026-01-02")
            buckets.map { it.average } shouldBe listOf(3.0, 5.0)
        }
    }

    test("question trend validates survey and field scope") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.get(
                "/api/v1/intern/stats/question-trend?team=flex&fieldId=score"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.BadRequest

            client.get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=flex&surveyId=survey-a&fieldId=not%20safe"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.BadRequest

            client.get(
                "/api/v1/intern/stats/question-trend" +
                    "?team=flex&surveyId=survey-a&fieldId=missing"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NotFound
        }
    }
})

private data class TrendOverrides(
    val team: String = "flex",
    val app: String = "app-a",
    val surveyId: String = "survey-a",
    val deviceType: String = "desktop",
    val segmentValue: String = "arbeidsgiver",
    val gateRating: Int = 5,
    val gateChoice: String = "yes",
    val task: String = "task-a",
)

private fun insertTrendFeedback(
    id: String,
    team: String,
    app: String,
    surveyId: String,
    submittedAt: OffsetDateTime,
    score: Int,
    deviceType: String = "desktop",
    segmentValue: String = "arbeidsgiver",
    gateRating: Int = 5,
    gateChoice: String = "yes",
    task: String = "task-a",
    singleChoice: String = "a",
    multiChoice: List<String> = listOf("a"),
) {
    val multiChoiceJson = multiChoice.joinToString(",") { "\"$it\"" }
    val options = """
        [
            {"id":"a","label":"Alternativ A"},
            {"id":"b","label":"Alternativ B"},
            {"id":"c","label":"Alternativ C"}
        ]
    """.trimIndent()
    val payload = """
        {
          "schemaVersion": 1,
          "surveyId": "$surveyId",
          "surveyType": "custom",
          "context": {
            "deviceType": "$deviceType",
            "tags": {"rolle": "$segmentValue"}
          },
          "answers": [
            {
              "fieldId": "score",
              "fieldType": "RATING",
              "question": {"label": "Hvor fornøyd er du?"},
              "value": {"type": "rating", "rating": $score}
            },
            {
              "fieldId": "gate-rating",
              "fieldType": "RATING",
              "question": {"label": "Gate rating"},
              "value": {"type": "rating", "rating": $gateRating}
            },
            {
              "fieldId": "gate-choice",
              "fieldType": "SINGLE_CHOICE",
              "question": {"label": "Gate choice", "options": [{"id":"yes","label":"Ja"},{"id":"no","label":"Nei"}]},
              "value": {"type": "singleChoice", "selectedOptionId": "$gateChoice"}
            },
            {
              "fieldId": "task",
              "fieldType": "SINGLE_CHOICE",
              "question": {"label": "Oppgave", "options": [{"id":"task-a","label":"A"},{"id":"task-b","label":"B"}]},
              "value": {"type": "singleChoice", "selectedOptionId": "$task"}
            },
            {
              "fieldId": "single",
              "fieldType": "SINGLE_CHOICE",
              "question": {"label": "Velg ett", "options": $options},
              "value": {"type": "singleChoice", "selectedOptionId": "$singleChoice"}
            },
            {
              "fieldId": "multiple",
              "fieldType": "MULTI_CHOICE",
              "question": {"label": "Velg flere", "options": $options},
              "value": {"type": "multiChoice", "selectedOptionIds": [$multiChoiceJson]}
            }
          ],
          "submittedAt": "${submittedAt.toInstant()}"
        }
    """.trimIndent()

    insertTestFeedbackWithJson(
        id = id,
        team = team,
        app = app,
        feedbackJson = payload,
        opprettet = submittedAt,
    )
}
