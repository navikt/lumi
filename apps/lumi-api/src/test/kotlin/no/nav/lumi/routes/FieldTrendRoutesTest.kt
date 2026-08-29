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
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.FeedbackStats
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class FieldTrendRoutesTest : FunSpec({
    val json = Json { ignoreUnknownKeys = true }

    beforeSpec { TestDatabase.initialize() }
    beforeTest { TestDatabase.clearAllData() }

    fun payload(
        surveyId: String,
        rating: Int? = null,
        singleChoice: String? = null,
        multiChoice: List<String>? = null,
        task: String? = null,
        segment: String = "pilot",
        surveyType: String = "custom",
    ): String = buildJsonObject {
        put("schemaVersion", 1)
        put("surveyId", surveyId)
        put("surveyType", surveyType)
        putJsonObject("context") {
            put("deviceType", "desktop")
            putJsonObject("tags") { put("variant", segment) }
        }
        putJsonArray("answers") {
            rating?.let {
                add(buildJsonObject {
                    put("fieldId", "experience")
                    put("fieldType", "RATING")
                    putJsonObject("question") { put("label", "Hvordan var opplevelsen?") }
                    putJsonObject("value") {
                        put("type", "rating")
                        put("rating", it)
                        put("ratingVariant", "emoji")
                        put("ratingScale", 5)
                    }
                })
            }
            singleChoice?.let {
                add(buildJsonObject {
                    put("fieldId", "identified")
                    put("fieldType", "SINGLE_CHOICE")
                    putJsonObject("question") {
                        put("label", "Ble behovet identifisert?")
                        putJsonArray("options") {
                            add(buildJsonObject { put("id", "yes"); put("label", "Ja") })
                            add(buildJsonObject { put("id", "no"); put("label", "Nei") })
                        }
                    }
                    putJsonObject("value") {
                        put("type", "singleChoice")
                        put("selectedOptionId", it)
                    }
                })
            }
            multiChoice?.let { choices ->
                add(buildJsonObject {
                    put("fieldId", "priorities")
                    put("fieldType", "MULTI_CHOICE")
                    putJsonObject("question") {
                        put("label", "Hva skal prioriteres?")
                        putJsonArray("options") {
                            add(buildJsonObject { put("id", "time"); put("label", "Tid") })
                            add(buildJsonObject { put("id", "quality"); put("label", "Kvalitet") })
                        }
                    }
                    putJsonObject("value") {
                        put("type", "multiChoice")
                        putJsonArray("selectedOptionIds") {
                            choices.forEach { add(JsonPrimitive(it)) }
                        }
                    }
                })
            }
            task?.let {
                add(buildJsonObject {
                    put("fieldId", "task")
                    put("fieldType", "SINGLE_CHOICE")
                    putJsonObject("question") {
                        put("label", "Hva kom du for å gjøre?")
                        putJsonArray("options") {
                            add(buildJsonObject { put("id", "apply"); put("label", "Søke") })
                            add(buildJsonObject { put("id", "appeal"); put("label", "Klage") })
                        }
                    }
                    putJsonObject("value") {
                        put("type", "singleChoice")
                        put("selectedOptionId", it)
                    }
                })
            }
        }
    }.toString()

    test("dashboard aggregates a selected rating field by Oslo calendar week") {
        val team = "flex"
        val surveyId = "bro-survey"
        val firstWeek = OffsetDateTime.parse("2026-08-03T10:00:00+02:00")
        val secondWeek = OffsetDateTime.parse("2026-08-10T10:00:00+02:00")

        listOf(1, 2, 3, 4, 5).forEachIndexed { index, rating ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, rating = rating),
                opprettet = firstWeek.plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, rating = 5),
                opprettet = secondWeek.plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-20" +
                    "&trendFieldId=experience&trendGranularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val trend = json.decodeFromString<FeedbackStats>(response.bodyAsText()).fieldTrend!!
            trend.fieldId shouldBe "experience"
            trend.points.map { it.periodStart } shouldBe listOf("2026-08-03", "2026-08-10")
            trend.points[0].responseCount shouldBe 5
            trend.points[0].average!! shouldBe (3.0 plusOrMinus 0.0001)
            trend.points[1].average!! shouldBe (5.0 plusOrMinus 0.0001)
        }
    }

    test("choice trend honors segment filters and counts respondents per option") {
        val team = "flex"
        val surveyId = "modia-survey"
        val submittedAt = OffsetDateTime.parse("2026-08-12T10:00:00+02:00")
        val matchingChoices = listOf(
            listOf("time", "quality"),
            listOf("time"),
            listOf("time"),
            listOf("quality"),
            listOf("quality"),
        )

        matchingChoices.forEachIndexed { index, choices ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    multiChoice = choices,
                    segment = "pilot",
                ),
                opprettet = submittedAt.plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    multiChoice = listOf("quality"),
                    segment = "other",
                ),
                opprettet = submittedAt.plusHours(1).plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = "another-team",
                feedbackJson = payload(surveyId = surveyId, multiChoice = listOf("quality")),
                opprettet = submittedAt.plusHours(2).plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&segment=variant:pilot&trendFieldId=priorities&trendGranularity=month"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val point = json.decodeFromString<FeedbackStats>(response.bodyAsText())
                .fieldTrend!!.points.single()
            point.responseCount shouldBe 5
            point.distribution shouldBe mapOf("quality" to 3, "time" to 3)
        }
    }

    test("field trend masks only calendar intervals below the aggregation threshold") {
        val team = "flex"
        val surveyId = "modia-survey"
        val firstWeek = OffsetDateTime.parse("2026-08-03T10:00:00+02:00")
        val secondWeek = OffsetDateTime.parse("2026-08-10T10:00:00+02:00")

        repeat(4) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, singleChoice = "yes"),
                opprettet = firstWeek.plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, singleChoice = "no"),
                opprettet = secondWeek.plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-20" +
                    "&trendFieldId=identified&trendGranularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val points = json.decodeFromString<FeedbackStats>(response.bodyAsText())
                .fieldTrend!!.points
            points[0].masked shouldBe true
            points[0].responseCount shouldBe null
            points[0].distribution shouldBe emptyMap()
            points[1].masked shouldBe false
            points[1].responseCount shouldBe 5
            points[1].distribution shouldBe mapOf("no" to 5)
        }
    }

    test("field trend honors active task rating and choice answer filters") {
        val team = "flex"
        val surveyId = "combined-survey"
        val submittedAt = OffsetDateTime.parse("2026-08-12T10:00:00+02:00")

        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    rating = 5,
                    singleChoice = "yes",
                    multiChoice = listOf("time"),
                    task = "apply",
                    surveyType = "topTasks",
                ),
                opprettet = submittedAt.plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    rating = 1,
                    singleChoice = "no",
                    multiChoice = listOf("quality"),
                    task = "appeal",
                    surveyType = "topTasks",
                ),
                opprettet = submittedAt.plusHours(1).plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&task=apply&rating=experience:5&choice=identified:yes" +
                    "&trendFieldId=priorities&trendGranularity=month"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val point = json.decodeFromString<FeedbackStats>(response.bodyAsText())
                .fieldTrend!!.points.single()
            point.responseCount shouldBe 5
            point.distribution shouldBe mapOf("time" to 5)
        }
    }

    test("dashboard rejects unsupported field trend granularity") {
        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard?team=flex&trendGranularity=quarter"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }
})
