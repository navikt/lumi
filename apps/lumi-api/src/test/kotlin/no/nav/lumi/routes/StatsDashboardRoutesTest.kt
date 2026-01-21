package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.maps.shouldContainKey
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.FieldStats
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.FeedbackStats
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.testModule
import java.time.OffsetDateTime

class StatsDashboardRoutesTest : FunSpec({

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun feedbackJson(
        surveyId: String,
        pathname: String,
        deviceType: String,
        rating: Int,
        text: String,
        startedAt: OffsetDateTime,
        submittedAt: OffsetDateTime,
    ): String {
        val payload = buildJsonObject {
            put("schemaVersion", 1)
            put("surveyId", surveyId)
            put("surveyType", "rating")
            putJsonObject("context") {
                put("pathname", pathname)
                put("deviceType", deviceType)
            }
            putJsonArray("answers") {
                add(
                    buildJsonObject {
                        put("fieldId", "svar")
                        put("fieldType", "RATING")
                        putJsonObject("question") { put("label", "Hvordan opplevde du tjenesten?") }
                        putJsonObject("value") {
                            put("type", "rating")
                            put("rating", rating)
                            put("ratingVariant", "emoji")
                            put("ratingScale", 5)
                        }
                    }
                )
                add(
                    buildJsonObject {
                        put("fieldId", "feedback")
                        put("fieldType", "TEXT")
                        putJsonObject("question") { put("label", "Har du tilbakemelding?") }
                        putJsonObject("value") {
                            put("type", "text")
                            put("text", text)
                        }
                    }
                )
            }
            put("startedAt", startedAt.toInstant().toString())
            put("submittedAt", submittedAt.toInstant().toString())
        }

        return payload.toString()
    }

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/stats/dashboard computes analytics breakdowns when not masked") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"

            val day1 = OffsetDateTime.parse("2026-01-20T10:00:00+01:00")
            val day2 = OffsetDateTime.parse("2026-01-21T10:00:00+01:00")

            // 5 responses => NOT masked (threshold is 5)
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = feedbackJson(
                    surveyId = "survey-a",
                    pathname = "/a",
                    deviceType = "desktop",
                    rating = 5,
                    text = "bra",
                    startedAt = day1.minusMinutes(1),
                    submittedAt = day1,
                ),
                opprettet = day1,
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = feedbackJson(
                    surveyId = "survey-b",
                    pathname = "/a",
                    deviceType = "desktop",
                    rating = 3,
                    text = "ok",
                    startedAt = day1.minusMinutes(2),
                    submittedAt = day1,
                ),
                opprettet = day1,
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = feedbackJson(
                    surveyId = "survey-c",
                    pathname = "/b",
                    deviceType = "mobile",
                    rating = 1,
                    text = "drlig",
                    startedAt = day1.minusMinutes(3),
                    submittedAt = day1,
                ),
                opprettet = day1,
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = feedbackJson(
                    surveyId = "survey-d",
                    pathname = "/b",
                    deviceType = "mobile",
                    rating = 2,
                    text = "ikke bra",
                    startedAt = day2.minusMinutes(1),
                    submittedAt = day2,
                ),
                opprettet = day2,
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = feedbackJson(
                    surveyId = "survey-e",
                    pathname = "/b",
                    deviceType = "desktop",
                    rating = 4,
                    text = "fin",
                    startedAt = day2.minusMinutes(2),
                    submittedAt = day2,
                ),
                opprettet = day2,
            )

            val response = createTestClient().get("/api/v1/intern/stats/dashboard?team=$team&app=$app") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<FeedbackStats>(response.bodyAsText())

            stats.totalCount shouldBe 5
            stats.privacy.shouldBeNull()

            stats.byDevice.size shouldBe 2
            stats.byDevice shouldContainKey "desktop"
            stats.byDevice shouldContainKey "mobile"
            stats.byDevice["desktop"]?.count shouldBe 3
            stats.byDevice["mobile"]?.count shouldBe 2

            // avg(desktop) = (5 + 3 + 4) / 3 = 4.0
            stats.byDevice["desktop"]?.averageRating shouldBe (4.0 plusOrMinus 0.0001)
            // avg(mobile) = (1 + 2) / 2 = 1.5
            stats.byDevice["mobile"]?.averageRating shouldBe (1.5 plusOrMinus 0.0001)

            stats.byPathname.size shouldBe 2
            stats.byPathname shouldContainKey "/a"
            stats.byPathname shouldContainKey "/b"

            stats.ratingByDate.size shouldBe 2
            stats.ratingByDate shouldContainKey "2026-01-20"
            stats.ratingByDate shouldContainKey "2026-01-21"

            // No surveyId => backend should not compute fieldStats (avoid heavy payload).
            stats.fieldStats shouldBe emptyList()
        }
    }

    test("GET /api/v1/intern/stats/dashboard includes fieldStats when surveyId is provided") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-42"
            val submittedAt = OffsetDateTime.parse("2026-01-21T10:00:00+01:00")

            val ratings = listOf(1, 2, 3, 4, 5)
            ratings.forEachIndexed { idx, rating ->
                val time = submittedAt.minusMinutes(idx.toLong())
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = feedbackJson(
                        surveyId = surveyId,
                        pathname = "/survey",
                        deviceType = "desktop",
                        rating = rating,
                        text = "dårlig",
                        startedAt = time.minusSeconds(30),
                        submittedAt = time,
                    ),
                    opprettet = time,
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/dashboard?team=$team&app=$app&surveyId=$surveyId") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            val body = response.bodyAsText()
            if (response.status != HttpStatusCode.OK) {
                println("Unexpected status=${response.status}. Body=$body")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<FeedbackStats>(body)
            stats.totalCount shouldBe 5
            stats.privacy.shouldBeNull()

            val ratingField = stats.fieldStats.first { it.fieldId == "svar" }
            ratingField.fieldType shouldBe FieldType.RATING
            val ratingStats = ratingField.stats as FieldStats.Rating
            ratingStats.average shouldBe (3.0 plusOrMinus 0.0001)
            ratingStats.distribution["1"] shouldBe 1
            ratingStats.distribution["5"] shouldBe 1

            val textField = stats.fieldStats.first { it.fieldId == "feedback" }
            textField.fieldType shouldBe FieldType.TEXT
            val textStats = textField.stats as FieldStats.Text
            textStats.responseCount shouldBe 5
            textStats.responseRate shouldBe (1.0 plusOrMinus 0.0001)
        }
    }

    test("GET /api/v1/intern/stats/dashboard preserves fieldStats question order") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val surveyId = "survey-ordering"
            val submittedAt = OffsetDateTime.parse("2026-01-21T10:00:00+01:00")

            fun feedbackJsonWithReorderedFieldIds(
                rating: Int,
                textSecondQuestion: String,
                textThirdQuestion: String,
                startedAt: OffsetDateTime,
                submittedAt: OffsetDateTime,
            ): String {
                val payload = buildJsonObject {
                    put("schemaVersion", 1)
                    put("surveyId", surveyId)
                    put("surveyType", "rating")
                    putJsonObject("context") {
                        put("pathname", "/ordering")
                        put("deviceType", "desktop")
                    }
                    putJsonArray("answers") {
                        // Q1
                        add(
                            buildJsonObject {
                                put("fieldId", "svar")
                                put("fieldType", "RATING")
                                putJsonObject("question") { put("label", "Q1") }
                                putJsonObject("value") {
                                    put("type", "rating")
                                    put("rating", rating)
                                    put("ratingVariant", "emoji")
                                    put("ratingScale", 5)
                                }
                            }
                        )

                        // Q2 (fieldId sorts AFTER Q3 lexicographically)
                        add(
                            buildJsonObject {
                                put("fieldId", "text-z")
                                put("fieldType", "TEXT")
                                putJsonObject("question") { put("label", "Q2") }
                                putJsonObject("value") {
                                    put("type", "text")
                                    put("text", textSecondQuestion)
                                }
                            }
                        )

                        // Q3 (fieldId sorts BEFORE Q2 lexicographically)
                        add(
                            buildJsonObject {
                                put("fieldId", "text-a")
                                put("fieldType", "TEXT")
                                putJsonObject("question") { put("label", "Q3") }
                                putJsonObject("value") {
                                    put("type", "text")
                                    put("text", textThirdQuestion)
                                }
                            }
                        )
                    }
                    put("startedAt", startedAt.toInstant().toString())
                    put("submittedAt", submittedAt.toInstant().toString())
                }

                return payload.toString()
            }

            // 5 responses => NOT masked (threshold is 5)
            repeat(5) { idx ->
                val time = submittedAt.minusMinutes(idx.toLong())
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = feedbackJsonWithReorderedFieldIds(
                        rating = 5,
                        textSecondQuestion = "second-$idx",
                        textThirdQuestion = "third-$idx",
                        startedAt = time.minusSeconds(30),
                        submittedAt = time,
                    ),
                    opprettet = time,
                )
            }

            val response = createTestClient().get(
                "/api/v1/intern/stats/dashboard?team=$team&app=$app&surveyId=$surveyId"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<FeedbackStats>(response.bodyAsText())
            stats.totalCount shouldBe 5
            stats.privacy.shouldBeNull()

            stats.fieldStats.map { it.fieldId } shouldBe listOf("svar", "text-z", "text-a")
            stats.fieldStats.map { it.label } shouldBe listOf("Q1", "Q2", "Q3")
        }
    }

    test("GET /api/v1/intern/stats/dashboard masks analytics when below privacy threshold") {
        testApplication {
            application { testModule() }

            val team = "flex"
            val app = "spinnsyn"
            val submittedAt = OffsetDateTime.parse("2026-01-21T10:00:00+01:00")

            // 4 responses => masked (threshold is 5)
            repeat(4) { idx ->
                val time = submittedAt.minusMinutes(idx.toLong())
                insertTestFeedbackWithJson(
                    team = team,
                    app = app,
                    feedbackJson = feedbackJson(
                        surveyId = "survey-$idx",
                        pathname = "/masked",
                        deviceType = "desktop",
                        rating = 5,
                        text = "tekst$idx",
                        startedAt = time.minusSeconds(30),
                        submittedAt = time,
                    ),
                    opprettet = time,
                )
            }

            val response = createTestClient().get("/api/v1/intern/stats/dashboard?team=$team&app=$app") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val stats = json.decodeFromString<FeedbackStats>(response.bodyAsText())
            stats.totalCount shouldBe 4
            stats.privacy?.masked shouldBe true

            stats.averageRating.shouldBeNull()
            stats.byRating shouldBe emptyMap()
            stats.ratingByDate shouldBe emptyMap()
            stats.byDevice shouldBe emptyMap()
            stats.byPathname shouldBe emptyMap()
            stats.lowestRatingPaths shouldBe emptyMap()
            stats.fieldStats shouldBe emptyList()
        }
    }
})
