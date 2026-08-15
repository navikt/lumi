package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.maps.shouldContainKey
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.collections.shouldContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.int
import no.nav.lumi.TestDatabase
import no.nav.lumi.createTestClient
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.insertTestRatingMarker
import no.nav.lumi.repository.SurveyMetadataRepository
import no.nav.lumi.testModule
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

class FeedbackRoutesTest : FunSpec({

    beforeSpec {
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    test("GET /api/v1/intern/feedback requires authentication") {
        testApplication {
            application { testModule() }
            
            val response = client.get("/api/v1/intern/feedback")
            
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("GET /api/v1/intern/feedback returns paginated results with auth") {
        testApplication {
            application { testModule() }
            
            // Insert test data
            insertTestFeedback(team = "team-test", app = "app-test")
            
            val response = createTestClient().get("/api/v1/intern/feedback?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body shouldContainKey "content"
            body shouldContainKey "totalPages"
        }
    }

    test("GET /api/v1/intern/feedback supports ratingFieldId + ratingValue filtering") {
        testApplication {
            application { testModule() }

            val team = "team-test"
            val app = "app-test"
            val surveyId = "survey-thumbs"

            fun thumbsJson(rating: Int): String {
                return """
                {
                  "schemaVersion": 1,
                  "surveyId": "$surveyId",
                  "surveyType": "rating",
                  "context": { "pathname": "/thumbs", "deviceType": "mobile" },
                  "answers": [
                    {
                      "fieldId": "helpful",
                      "fieldType": "RATING",
                      "question": { "label": "Var denne informasjonen nyttig?" },
                      "value": { "type": "rating", "rating": $rating, "ratingVariant": "thumbs", "ratingScale": 2 }
                    }
                  ],
                  "submittedAt": "2026-01-21T09:00:00Z"
                }
                """.trimIndent()
            }

            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = thumbsJson(2))
            insertTestFeedbackWithJson(team = team, app = app, feedbackJson = thumbsJson(1))

            val response = createTestClient().get(
                "/api/v1/intern/feedback?team=$team&app=$app&surveyId=$surveyId&ratingFieldId=helpful&ratingValue=2"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            val content = body["content"].shouldNotBeNull().jsonArray
            content.size shouldBe 1
        }
    }

    test("GET /api/v1/intern/feedback supports phrase filtering") {
        testApplication {
            application { testModule() }

            val team = "team-test"
            val app = "app-test"
            val surveyId = "survey-phrase-route"

            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = """
                    {
                      "schemaVersion": 1,
                      "surveyId": "$surveyId",
                      "surveyType": "rating",
                      "context": { "pathname": "/phrase", "deviceType": "desktop" },
                      "answers": [
                        {
                          "fieldId": "feedback",
                          "fieldType": "TEXT",
                          "question": { "label": "Har du tilbakemelding?" },
                          "value": { "type": "text", "text": "Det er vanskelig å svare raskt" }
                        }
                      ],
                      "submittedAt": "2026-01-21T09:00:00Z"
                    }
                """.trimIndent()
            )
            insertTestFeedbackWithJson(
                team = team,
                app = app,
                feedbackJson = """
                    {
                      "schemaVersion": 1,
                      "surveyId": "$surveyId",
                      "surveyType": "rating",
                      "context": { "pathname": "/phrase", "deviceType": "desktop" },
                      "answers": [
                        {
                          "fieldId": "feedback",
                          "fieldType": "TEXT",
                          "question": { "label": "Har du tilbakemelding?" },
                          "value": { "type": "text", "text": "Dette er lett å lese" }
                        }
                      ],
                      "submittedAt": "2026-01-21T09:05:00Z"
                    }
                """.trimIndent()
            )

            val response = createTestClient().get(
                "/api/v1/intern/feedback?team=$team&app=$app&surveyId=$surveyId&phrase=feedback:vanskelig%20svare"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["totalElements"]?.jsonPrimitive?.int shouldBe 1
        }
    }

    test("GET /api/v1/intern/feedback rejects multiple phrase filters") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get(
                "/api/v1/intern/feedback?team=team-test&phrase=feedback:vanskelig%20svare&phrase=feedback:digital%20soknad"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("GET /api/v1/intern/feedback/tags returns list of tags") {
        testApplication {
            application { testModule() }
            
            // Insert feedback with tags
            insertTestFeedback(team = "team-test", tags = "bug,feature")
            insertTestFeedback(team = "other-team", tags = "internal")
            
            val response = createTestClient().get("/api/v1/intern/feedback/tags?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val tags = Json.parseToJsonElement(response.bodyAsText()).jsonArray
                .map { it.jsonPrimitive.content }
                .toSet()
            tags shouldContain "bug"
            tags shouldContain "feature"
            tags.contains("internal") shouldBe false
        }
    }

    test("GET /api/v1/intern/feedback/teams returns teams and apps") {
        testApplication {
            application { testModule() }
            
            insertTestFeedback(team = "flex", app = "spinnsyn")
            
            val response = createTestClient().get("/api/v1/intern/feedback/teams?team=flex") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val teams = Json.parseToJsonElement(response.bodyAsText()).jsonObject["teams"]
                .shouldNotBeNull()
                .jsonObject
            teams shouldContainKey "flex"
            teams["flex"].shouldNotBeNull().jsonArray
                .map { it.jsonPrimitive.content }
                .toSet() shouldContain "spinnsyn"
        }
    }

    test("GET /api/v1/intern/feedback/{id} returns feedback by id") {
        testApplication {
            application { testModule() }
            
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "team-test")
            
            val response = createTestClient().get("/api/v1/intern/feedback/$id?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["id"]?.jsonPrimitive?.content shouldBe id
        }
    }

    test("GET /api/v1/intern/feedback/{id} returns 404 for feedback from another team") {
        testApplication {
            application { testModule() }

            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "another-team")

            val response = createTestClient().get("/api/v1/intern/feedback/$id?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("GET /api/v1/intern/feedback/{id} returns 404 for unknown id") {
        testApplication {
            application { testModule() }
            
            val response = createTestClient().get("/api/v1/intern/feedback/unknown-id") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("DELETE /api/v1/intern/feedback/{id} returns 404 for unknown id") {
        testApplication {
            application { testModule() }
            
            val response = createTestClient().delete("/api/v1/intern/feedback/unknown-id") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            
            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("DELETE /api/v1/intern/feedback/{id} returns 404 for feedback from another team") {
        testApplication {
            application { testModule() }

            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "another-team")

            val response = createTestClient().delete("/api/v1/intern/feedback/$id?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("POST /api/v1/intern/feedback/{id}/tags adds tag to feedback") {
        testApplication {
            application { testModule() }
            
            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "team-test")
            
            val response = createTestClient().post("/api/v1/intern/feedback/$id/tags?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"tag": "test-tag"}""")
            }
            
            response.status shouldBe HttpStatusCode.Created
        }
    }

    test("POST /api/v1/intern/feedback/{id}/tags returns 404 for feedback from another team") {
        testApplication {
            application { testModule() }

            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "another-team")

            val response = createTestClient().post("/api/v1/intern/feedback/$id/tags?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"tag": "test-tag"}""")
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("POST /api/v1/intern/feedback/{id}/tags returns 404 for unknown id") {
        testApplication {
            application { testModule() }
            
            val response = createTestClient().post("/api/v1/intern/feedback/unknown-id/tags") {
                header(HttpHeaders.Authorization, "Bearer test-token")
                contentType(ContentType.Application.Json)
                setBody("""{"tag": "test-tag"}""")
            }
            
            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("DELETE /api/v1/intern/feedback/{id}/tags removes tag from feedback") {
        testApplication {
            application { testModule() }

            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "team-test", tags = "keep,remove-me")

            val response = createTestClient().delete("/api/v1/intern/feedback/$id/tags?team=team-test&tag=remove-me") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.NoContent

            val feedbackResponse = createTestClient().get("/api/v1/intern/feedback/$id?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            feedbackResponse.status shouldBe HttpStatusCode.OK
            val tags = Json.parseToJsonElement(feedbackResponse.bodyAsText()).jsonObject["tags"]
                .shouldNotBeNull()
                .jsonArray
                .map { it.jsonPrimitive.content }
                .toSet()
            tags shouldContain "keep"
            tags.contains("remove-me") shouldBe false
        }
    }

    test("DELETE /api/v1/intern/feedback/{id}/tags returns 400 when tag param is missing") {
        testApplication {
            application { testModule() }

            val id = UUID.randomUUID().toString()
            insertTestFeedback(id = id, team = "team-test", tags = "remove-me")

            val response = createTestClient().delete("/api/v1/intern/feedback/$id/tags?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["error"]?.jsonPrimitive?.content shouldBe "Missing tag parameter"
        }
    }

    test("GET /api/v1/intern/surveys/{surveyId}/context-tags returns tag values with counts") {
        testApplication {
            application { testModule() }

            val surveyId = "survey-ctx-1"

            // 2x Ja, 1x Nei
            insertTestFeedbackWithJson(
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                                                                                        "surveyId": "$surveyId",
                      "context": {"tags": {"abTest": "A"}},
                      "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                      ]
                    }
                """.trimIndent(),
            )
            insertTestFeedbackWithJson(
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                                                                                        "surveyId": "$surveyId",
                      "context": {"tags": {"abTest": "A"}},
                      "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 5}}
                      ]
                    }
                """.trimIndent(),
            )
            insertTestFeedbackWithJson(
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                                            "surveyId": "$surveyId",
                      "context": {"tags": {"abTest": "B"}},
                      "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 3}}
                      ]
                    }
                """.trimIndent(),
            )

            val response = createTestClient().get(
                "/api/v1/intern/surveys/$surveyId/context-tags?maxCardinality=10&team=team-test"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val json = Json { ignoreUnknownKeys = true }
            val body = json.parseToJsonElement(response.bodyAsText()).jsonObject

            body["surveyId"]?.jsonPrimitive?.content shouldBe surveyId
            val contextTags = body["contextTags"].shouldNotBeNull().jsonObject
            contextTags shouldContainKey "abTest"

            val values = contextTags["abTest"].shouldNotBeNull().jsonArray
            val countsByValue = values.associate {
                it.jsonObject["value"]?.jsonPrimitive?.content.orEmpty() to
                    it.jsonObject["count"]?.jsonPrimitive?.int
            }
            countsByValue["A"] shouldBe 2
            countsByValue["B"] shouldBe 1
        }
    }

        test("GET /api/v1/intern/surveys/{surveyId}/context-tags honors date/device/hasText/lowRating filters") {
                testApplication {
                        application { testModule() }

                        val surveyId = "survey-ctx-filters-1"
                        val tsInRange = OffsetDateTime.parse("2026-01-01T12:00:00Z")
                        val tsOutOfRange = OffsetDateTime.parse("2026-01-02T12:00:00Z")

                        // Only this row should match all filters below (mobile, hasText, lowRating, date)
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"abTest": "A"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Bra nok"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        // Same date, low rating, but wrong deviceType
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsInRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "desktop",
                                                "tags": {"abTest": "A"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 1}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": ""}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        // Out of date range
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                opprettet = tsOutOfRange,
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {
                                                "deviceType": "mobile",
                                                "tags": {"abTest": "B"}
                                            },
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 2}},
                                                {"fieldId": "text", "fieldType": "TEXT", "question": {"label": "Hvorfor?"}, "value": {"type": "text", "text": "Utenfor"}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        val response = createTestClient().get(
                                "/api/v1/intern/surveys/$surveyId/context-tags?maxCardinality=10&team=team-test&fromDate=2026-01-01&toDate=2026-01-01&deviceType=mobile&hasText=true&lowRating=true"
                        ) {
                                header(HttpHeaders.Authorization, "Bearer test-token")
                        }

                        response.status shouldBe HttpStatusCode.OK

                        val json = Json { ignoreUnknownKeys = true }
                        val body = json.parseToJsonElement(response.bodyAsText()).jsonObject
                        val contextTags = body["contextTags"].shouldNotBeNull().jsonObject
                        val values = contextTags["abTest"].shouldNotBeNull().jsonArray
                        val countsByValue = values.associate {
                            it.jsonObject["value"]?.jsonPrimitive?.content.orEmpty() to
                                it.jsonObject["count"]?.jsonPrimitive?.int
                        }
                        countsByValue["A"] shouldBe 1
                        countsByValue.containsKey("B") shouldBe false
                }
        }

        test("GET /api/v1/intern/surveys/{surveyId}/context-tags returns stable ordering by count desc then value") {
                testApplication {
                        application { testModule() }

                        val surveyId = "survey-ctx-order-1"

                        // k=A count 2, k=B count 2 (tie), k=C count 1
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {"tags": {"k": "B"}},
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                                            ]
                                        }
                                """.trimIndent(),
                        )
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {"tags": {"k": "B"}},
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 5}}
                                            ]
                                        }
                                """.trimIndent(),
                        )
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {"tags": {"k": "A"}},
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                                            ]
                                        }
                                """.trimIndent(),
                        )
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {"tags": {"k": "A"}},
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 5}}
                                            ]
                                        }
                                """.trimIndent(),
                        )
                        insertTestFeedbackWithJson(
                                team = "team-test",
                                app = "app-test",
                                feedbackJson = """
                                        {
                                            "surveyId": "$surveyId",
                                            "context": {"tags": {"k": "C"}},
                                            "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 3}}
                                            ]
                                        }
                                """.trimIndent(),
                        )

                        val response = createTestClient().get(
                                "/api/v1/intern/surveys/$surveyId/context-tags?maxCardinality=10&team=team-test"
                        ) {
                                header(HttpHeaders.Authorization, "Bearer test-token")
                        }

                        response.status shouldBe HttpStatusCode.OK

                        val json = Json { ignoreUnknownKeys = true }
                        val body = json.parseToJsonElement(response.bodyAsText()).jsonObject
                        val contextTags = body["contextTags"].shouldNotBeNull().jsonObject
                        val values = contextTags["k"].shouldNotBeNull().jsonArray

                        // Order: count desc, then value asc => A(2), B(2), C(1)
                        values[0].jsonObject["value"]?.jsonPrimitive?.content shouldBe "A"
                        values[0].jsonObject["count"]?.jsonPrimitive?.int shouldBe 2
                        values[1].jsonObject["value"]?.jsonPrimitive?.content shouldBe "B"
                        values[1].jsonObject["count"]?.jsonPrimitive?.int shouldBe 2
                        values[2].jsonObject["value"]?.jsonPrimitive?.content shouldBe "C"
                        values[2].jsonObject["count"]?.jsonPrimitive?.int shouldBe 1
                }
        }

    test("DELETE /api/v1/intern/surveys/{surveyId} deletes all feedback for survey and returns count") {
        testApplication {
            application { testModule() }

            val surveyId = "survey-delete-1"

            insertTestFeedbackWithJson(
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                      "surveyId": "$surveyId",
                      "answers": [
                        {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                      ]
                    }
                """.trimIndent(),
            )
            insertTestFeedbackWithJson(
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                      "surveyId": "$surveyId",
                      "answers": [
                        {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 5}}
                      ]
                    }
                """.trimIndent(),
            )

            val response = createTestClient().delete("/api/v1/intern/surveys/$surveyId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK
            val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            body["surveyId"]?.jsonPrimitive?.content shouldBe surveyId
            body["deletedCount"]?.jsonPrimitive?.int shouldBe 2

            // Ensure it's gone
            val after = createTestClient().get("/api/v1/intern/feedback?surveyId=$surveyId&team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            after.status shouldBe HttpStatusCode.OK

            val afterJson = Json.parseToJsonElement(after.bodyAsText()).jsonObject
            afterJson["totalElements"].shouldNotBeNull().jsonPrimitive.int shouldBe 0
        }
    }

    test("DELETE /api/v1/intern/surveys/{surveyId} invalidates cached bootstrap even when survey is already empty") {
        testApplication {
            application { testModule() }

            val surveyId = "survey-empty-cached"
            val feedbackId = UUID.randomUUID().toString()
            val client = createTestClient()
            insertTestFeedback(
                id = feedbackId,
                team = "team-test",
                app = "app-test",
                surveyId = surveyId,
            )

            val before = client.get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            val beforeSurveys = Json.parseToJsonElement(before.bodyAsText())
                .jsonObject["surveysByApp"]!!.jsonObject["app-test"]!!.jsonArray
            beforeSurveys.any { it.jsonPrimitive.content == surveyId } shouldBe true

            client.delete("/api/v1/intern/feedback/$feedbackId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }.status shouldBe HttpStatusCode.NoContent

            val deleteSurvey = client.delete("/api/v1/intern/surveys/$surveyId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            Json.parseToJsonElement(deleteSurvey.bodyAsText())
                .jsonObject["deletedCount"]!!.jsonPrimitive.int shouldBe 0

            val after = client.get("/api/v1/intern/filters/bootstrap?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }
            val afterApps = Json.parseToJsonElement(after.bodyAsText())
                .jsonObject["surveysByApp"]!!.jsonObject
            val afterSurveys = afterApps["app-test"]?.jsonArray.orEmpty()
            afterSurveys.any { it.jsonPrimitive.content == surveyId } shouldBe false
        }
    }

    test("DELETE /api/v1/intern/surveys/{surveyId} does not delete another team's survey") {
        testApplication {
            application { testModule() }

            val surveyId = "survey-delete-2"

            insertTestFeedbackWithJson(
                team = "another-team",
                app = "app-test",
                feedbackJson = """
                    {
                      "surveyId": "$surveyId",
                      "answers": [
                        {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                      ]
                    }
                """.trimIndent(),
            )

            val response = createTestClient().delete("/api/v1/intern/surveys/$surveyId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val deleteJson = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            deleteJson["deletedCount"].shouldNotBeNull().jsonPrimitive.int shouldBe 0

            // Still exists under the other team (verified directly in DB, since the test user is not authorized for another-team)
            val remainingOtherTeamRows = TestDatabase.dataSource.connection.use { conn ->
                conn.prepareStatement(
                    """
                    SELECT COUNT(*)
                    FROM feedback
                    WHERE team = ?
                                            AND feedback_json::jsonb->>'surveyId' = ?
                    """.trimIndent()
                ).use { stmt ->
                    stmt.setString(1, "another-team")
                    stmt.setString(2, surveyId)

                    stmt.executeQuery().use { rs ->
                        rs.next()
                        rs.getInt(1)
                    }
                }
            }

            remainingOtherTeamRows shouldBe 1
        }
    }

    test("DELETE /api/v1/intern/surveys/{surveyId} also deletes markers for that survey and team") {
        testApplication {
            application { testModule() }

            val surveyId = "survey-delete-with-markers"
            val team = "team-test"

            insertTestFeedbackWithJson(
                team = team,
                app = "app-test",
                feedbackJson = """
                    {
                      "surveyId": "$surveyId",
                      "answers": [
                        {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                      ]
                    }
                """.trimIndent(),
            )

            insertTestRatingMarker(
                team = team,
                surveyId = surveyId,
                markerDate = LocalDate.parse("2026-02-01"),
                label = "Skal slettes",
            )
            insertTestRatingMarker(
                team = team,
                surveyId = "another-survey",
                markerDate = LocalDate.parse("2026-02-02"),
                label = "Skal bli igjen",
            )
            SurveyMetadataRepository().archive(team, surveyId, "A123456")

            val response = createTestClient().delete("/api/v1/intern/surveys/$surveyId?team=$team") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val rowsForDeletedSurvey = TestDatabase.dataSource.connection.use { conn ->
                conn.prepareStatement(
                    """
                    SELECT COUNT(*)
                    FROM rating_marker
                    WHERE team = ? AND survey_id = ?
                    """.trimIndent()
                ).use { stmt ->
                    stmt.setString(1, team)
                    stmt.setString(2, surveyId)
                    stmt.executeQuery().use { rs ->
                        rs.next()
                        rs.getInt(1)
                    }
                }
            }
            rowsForDeletedSurvey shouldBe 0

            val rowsForOtherSurvey = TestDatabase.dataSource.connection.use { conn ->
                conn.prepareStatement(
                    """
                    SELECT COUNT(*)
                    FROM rating_marker
                    WHERE team = ? AND survey_id = ?
                    """.trimIndent()
                ).use { stmt ->
                    stmt.setString(1, team)
                    stmt.setString(2, "another-survey")
                    stmt.executeQuery().use { rs ->
                        rs.next()
                        rs.getInt(1)
                    }
                }
            }
            rowsForOtherSurvey shouldBe 1
            SurveyMetadataRepository().findByTeam(team).none { it.surveyId == surveyId } shouldBe true
        }
    }

    test("GET /api/v1/intern/feedback/{id} parses nested context.viewport") {
        testApplication {
            application { testModule() }

            val rowId = UUID.randomUUID().toString()
            val surveyId = "survey-viewport-1"

            insertTestFeedbackWithJson(
                id = rowId,
                team = "team-test",
                app = "app-test",
                feedbackJson = """
                    {
                                            "surveyId": "$surveyId",
                      "context": {"viewport": {"width": 777, "height": 555}},
                      "answers": [
                                                {"fieldId": "rating", "fieldType": "RATING", "question": {"label": "Hvordan?"}, "value": {"type": "rating", "rating": 4}}
                      ]
                    }
                """.trimIndent(),
            )

            val response = createTestClient().get("/api/v1/intern/feedback/$rowId?team=team-test") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.OK

            val json = Json { ignoreUnknownKeys = true }
            val body = json.parseToJsonElement(response.bodyAsText()).jsonObject
            val context = body["context"].shouldNotBeNull().jsonObject

            context["viewportWidth"].shouldNotBeNull().jsonPrimitive.int shouldBe 777
            context["viewportHeight"].shouldNotBeNull().jsonPrimitive.int shouldBe 555
        }
    }

    test("GET /api/v1/intern/feedback rejects negative page") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get("/api/v1/intern/feedback?team=team-test&page=-1") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]
                ?.jsonPrimitive
                ?.content shouldBe "Invalid page: must be >= 0"
        }
    }

    test("GET /api/v1/intern/feedback rejects oversized page size") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get("/api/v1/intern/feedback?team=team-test&size=100000") {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]
                ?.jsonPrimitive
                ?.content shouldBe "Invalid size: must be between 1 and 200"
        }
    }

    test("GET /api/v1/intern/feedback rejects invalid date format") {
        testApplication {
            application { testModule() }

            val response = createTestClient().get(
                "/api/v1/intern/feedback?team=team-test&fromDate=2026-99-99"
            ) {
                header(HttpHeaders.Authorization, "Bearer test-token")
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]
                ?.jsonPrimitive
                ?.content shouldBe "Invalid fromDate: expected YYYY-MM-DD"
        }
    }
})
