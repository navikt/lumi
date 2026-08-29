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
import no.nav.lumi.domain.FieldDefinition
import no.nav.lumi.domain.FieldTrendResponse
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.SurveyDefinition
import no.nav.lumi.domain.SurveyType
import no.nav.lumi.domain.computeHash
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.repository.SurveyDefinitionRepository
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
        ratingFieldId: String = "experience",
        ratingVariant: String = "emoji",
        ratingScale: Int = 5,
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
                    put("fieldId", ratingFieldId)
                    put("fieldType", "RATING")
                    putJsonObject("question") { put("label", "Hvordan var opplevelsen?") }
                    putJsonObject("value") {
                        put("type", "rating")
                        put("rating", it)
                        put("ratingVariant", ratingVariant)
                        put("ratingScale", ratingScale)
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

    test("field trend endpoint aggregates a selected rating field by Oslo calendar week") {
        val team = "team-esyfo"
        val surveyId = "bro-kartleggingssporsmal"
        val firstWeek = OffsetDateTime.parse("2026-08-03T10:00:00+02:00")
        val secondWeek = OffsetDateTime.parse("2026-08-10T10:00:00+02:00")

        listOf(1, 2, 3, 4, 5).forEachIndexed { index, rating ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    rating = rating,
                    ratingFieldId = "opplevelse",
                    surveyType = "rating",
                ),
                opprettet = firstWeek.plusMinutes(index.toLong()),
            )
        }
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    rating = 5,
                    ratingFieldId = "opplevelse",
                    surveyType = "rating",
                ),
                opprettet = secondWeek.plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-20" +
                    "&fieldId=opplevelse&granularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val payload = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
            val trend = payload.trend!!
            trend.fieldId shouldBe "opplevelse"
            trend.points.map { it.periodStart } shouldBe
                listOf("2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17")
            val populated = trend.points.filterNot { it.empty }
            populated[0].responseCount shouldBe 5
            populated[0].average!! shouldBe (3.0 plusOrMinus 0.0001)
            populated[1].average!! shouldBe (5.0 plusOrMinus 0.0001)
            payload.fields.single().ratingMin shouldBe 1
            payload.fields.single().ratingMax shouldBe 5
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
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&segment=variant:pilot&fieldId=priorities&granularity=month"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val point = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
                .trend!!.points.single()
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
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-20" +
                    "&fieldId=identified&granularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val points = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
                .trend!!.points.filterNot { it.empty }
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
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&task=apply&rating=experience:5&choice=identified:yes" +
                    "&fieldId=priorities&granularity=month"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val point = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
                .trend!!.points.single()
            point.responseCount shouldBe 5
            point.distribution shouldBe mapOf("time" to 5)
        }
    }

    test("field catalog remains stable when active filters contain no answers") {
        val team = "team-esyfo"
        val surveyId = "modia-kartleggingssporsmal"
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = surveyId,
                    singleChoice = "yes",
                    segment = "pilot",
                ),
                opprettet = OffsetDateTime.parse("2026-08-12T10:00:00+02:00")
                    .plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&segment=variant:no-matches&fieldId=stale-field&granularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val result = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
            result.fields.map { it.fieldId } shouldBe listOf("identified")
            result.trend!!.fieldId shouldBe "identified"
            result.trend.points.all { it.empty } shouldBe true
        }
    }

    test("field catalog includes definition fields that have no raw answers") {
        val team = "team-esyfo"
        val surveyId = "definition-backed-survey"
        val definition = SurveyDefinition(
            surveyId = surveyId,
            surveyType = SurveyType.CUSTOM,
            fields = listOf(
                FieldDefinition(
                    fieldId = "definition-only",
                    fieldType = FieldType.SINGLE_CHOICE,
                    ratingVariant = null,
                    ratingScale = null,
                    optionIds = listOf("yes", "no"),
                )
            ),
        )
        SurveyDefinitionRepository().insertIfUnderLimit(
            team = team,
            definition = definition,
            definitionHash = definition.computeHash(),
            maxDefinitions = 500,
        ) shouldBe 1

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-08-01&toDate=2026-08-31" +
                    "&fieldId=definition-only&granularity=week"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val result = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
            result.fields.map { it.fieldId } shouldBe listOf("definition-only")
            result.fields.single().options.map { it.id } shouldBe listOf("yes", "no")
            result.trend!!.fieldId shouldBe "definition-only"
            result.trend.points.all { it.empty } shouldBe true
        }
    }

    test("field catalog exposes exact NPS and thumbs scales") {
        val team = "team-esyfo"
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = "nps-survey",
                    rating = 4,
                    ratingFieldId = "nps-score",
                    ratingVariant = "nps",
                    ratingScale = 11,
                ),
                opprettet = OffsetDateTime.parse("2026-08-12T10:00:00+02:00")
                    .plusMinutes(index.toLong()),
            )
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(
                    surveyId = "thumbs-survey",
                    rating = 2,
                    ratingFieldId = "thumbs-score",
                    ratingVariant = "thumbs",
                    ratingScale = 2,
                ),
                opprettet = OffsetDateTime.parse("2026-08-12T11:00:00+02:00")
                    .plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val client = createTestClient()
            val nps = client.get(
                "/api/v1/intern/stats/field-trend?team=$team&surveyId=nps-survey&fieldId=nps-score"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }
            val thumbs = client.get(
                "/api/v1/intern/stats/field-trend?team=$team&surveyId=thumbs-survey&fieldId=thumbs-score"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            val npsField = json.decodeFromString<FieldTrendResponse>(nps.bodyAsText()).fields.single()
            npsField.ratingMin shouldBe 0
            npsField.ratingMax shouldBe 10
            val thumbsField = json.decodeFromString<FieldTrendResponse>(thumbs.bodyAsText()).fields.single()
            thumbsField.ratingMin shouldBe 1
            thumbsField.ratingMax shouldBe 2
        }
    }

    test("daily buckets follow Oslo dates across the daylight saving transition") {
        val team = "team-esyfo"
        val surveyId = "dst-survey"
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, singleChoice = "yes"),
                opprettet = OffsetDateTime.parse("2026-03-28T23:30:00Z")
                    .plusMinutes(index.toLong()),
            )
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, singleChoice = "no"),
                opprettet = OffsetDateTime.parse("2026-03-29T22:30:00Z")
                    .plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2026-03-29&toDate=2026-03-30" +
                    "&fieldId=identified&granularity=day"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.OK
            val points = json.decodeFromString<FieldTrendResponse>(response.bodyAsText())
                .trend!!.points
            points.map { it.periodStart } shouldBe listOf("2026-03-29", "2026-03-30")
            points.map { it.responseCount } shouldBe listOf(5, 5)
        }
    }

    test("field trend endpoint rejects missing survey and excessive date ranges") {
        testApplication {
            application { testModule() }
            val client = createTestClient()
            val missingSurvey = client.get(
                "/api/v1/intern/stats/field-trend?team=team-esyfo"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }
            val excessiveRange = client.get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=team-esyfo&surveyId=survey-1&fromDate=2020-01-01&toDate=2026-01-01" +
                    "&granularity=day"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            missingSurvey.status shouldBe HttpStatusCode.BadRequest
            excessiveRange.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("field trend endpoint rejects excessive one-sided date ranges") {
        val team = "team-esyfo"
        val surveyId = "range-survey"
        repeat(5) { index ->
            insertTestFeedbackWithJson(
                team = team,
                feedbackJson = payload(surveyId = surveyId, singleChoice = "yes"),
                opprettet = OffsetDateTime.parse("2026-08-12T10:00:00+02:00")
                    .plusMinutes(index.toLong()),
            )
        }

        testApplication {
            application { testModule() }
            val client = createTestClient()
            val oldStart = client.get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&fromDate=2000-01-01" +
                    "&fieldId=identified&granularity=day"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }
            val futureEnd = client.get(
                "/api/v1/intern/stats/field-trend" +
                    "?team=$team&surveyId=$surveyId&toDate=2040-01-01" +
                    "&fieldId=identified&granularity=day"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            oldStart.status shouldBe HttpStatusCode.BadRequest
            futureEnd.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("field trend endpoint rejects unsupported granularity") {
        testApplication {
            application { testModule() }
            val response = createTestClient().get(
                "/api/v1/intern/stats/field-trend?team=flex&surveyId=survey-1&granularity=quarter"
            ) { header(HttpHeaders.Authorization, "Bearer test-token") }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }
})
