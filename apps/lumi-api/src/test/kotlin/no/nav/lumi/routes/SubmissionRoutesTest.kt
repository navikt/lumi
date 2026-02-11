package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.createTestClient
import no.nav.lumi.testModule

class SubmissionRoutesTest : FunSpec({

    test("should accept canonical schemaVersion=1 submissions") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                                            "schemaVersion": 1,
                                            "surveyId": "dp-feedback",
                                            "surveyType": "rating",
                                            "startedAt": "2026-01-10T12:00:00Z",
                                            "submittedAt": "2026-01-10T12:00:12Z",
                                            "timeToCompleteMs": 12000,
                                            "context": {
                                                "pathname": "/soknad",
                                                "deviceType": "mobile",
                                                "viewport": { "width": 390, "height": 844 },
                                                "tags": { "rolle": "privatperson", "uke": 3, "harAktivSykmelding": true }
                      },
                                            "answers": [
                        {
                                                    "fieldId": "rating",
                                                    "fieldType": "RATING",
                                                    "question": { "label": "Hvor fornøyd er du?", "description": null, "options": null },
                                                    "value": { "type": "rating", "rating": 2, "ratingVariant": "emoji", "ratingScale": 5 }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.Created

            val parsed = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            parsed["id"]?.jsonPrimitive?.content?.isNotBlank() shouldBe true
        }
    }

        test("should accept schemaVersion=1 submissions via azure endpoint") {
                testApplication {
                        application { testModule() }
                        val client = createTestClient()

                        val response = client.post("/api/azure/v1/feedback") {
                                contentType(ContentType.Application.Json)
                                setBody(
                                        """
                                        {
                                            "schemaVersion": 1,
                                            "surveyId": "dp-feedback",
                                            "surveyType": "rating",
                                            "submittedAt": "2026-01-10T12:00:12Z",
                                            "answers": [
                                                {
                                                    "fieldId": "rating",
                                                    "fieldType": "RATING",
                                                    "question": { "label": "Hvor fornøyd er du?", "description": null, "options": null },
                                                    "value": { "type": "rating", "rating": 2, "ratingVariant": "emoji", "ratingScale": 5 }
                                                }
                                            ]
                                        }
                                        """.trimIndent()
                                )
                        }

                        response.status shouldBe HttpStatusCode.Created
                }
        }

    test("legacy /api/v1/feedback should not exist") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val response = client.post("/api/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }

    test("should reject invalid payload") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "surveyId": "missing-required-fields"
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.isNullOrBlank() == false) shouldBe true
        }
    }

    test("should reject empty answers") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                                            "schemaVersion": 1,
                                            "surveyId": "dp-feedback",
                                            "surveyType": "rating",
                                            "submittedAt": "2026-01-10T12:00:12Z",
                                            "answers": []
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("should reject payloads larger than limit") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val largeText = "a".repeat(1_100_000)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "text",
                      "fieldType": "TEXT",
                      "question": { "label": "Hvorfor?" },
                      "value": { "type": "text", "text": "$largeText" }
                    }
                  ]
                }
            """.trimIndent()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.PayloadTooLarge
        }
    }

    test("should reject submissions with too many answers") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val answers = (1..51).joinToString(",") { index ->
                """
                {
                  "fieldId": "q$index",
                  "fieldType": "TEXT",
                  "question": { "label": "Spm $index" },
                  "value": { "type": "text", "text": "ok" }
                }
                """.trimIndent()
            }

            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [$answers]
                }
            """.trimIndent()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("answers max count", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject text answers exceeding max length") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongText = "x".repeat(2_001)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "feedback",
                      "fieldType": "TEXT",
                      "question": { "label": "Hvorfor?" },
                      "value": { "type": "text", "text": "$tooLongText" }
                    }
                  ]
                }
            """.trimIndent()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("text answer max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject submissions with too many context tags") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tags = (1..21).joinToString(",") { index -> """"k$index":"v$index"""" }
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "context": {
                    "tags": { $tags }
                  },
                  "answers": [
                    {
                      "fieldId": "rating",
                      "fieldType": "RATING",
                      "question": { "label": "Hvor fornøyd er du?" },
                      "value": { "type": "rating", "rating": 4, "ratingVariant": "emoji", "ratingScale": 5 }
                    }
                  ]
                }
            """.trimIndent()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("context.tags max count", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject submissions with too deep context debug object") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "context": {
                    "debug": {
                      "a": {
                        "b": {
                          "c": {
                            "d": {
                              "e": "value"
                            }
                          }
                        }
                      }
                    }
                  },
                  "answers": [
                    {
                      "fieldId": "rating",
                      "fieldType": "RATING",
                      "question": { "label": "Hvor fornøyd er du?" },
                      "value": { "type": "rating", "rating": 4, "ratingVariant": "emoji", "ratingScale": 5 }
                    }
                  ]
                }
            """.trimIndent()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("context.debug max depth", ignoreCase = true) == true) shouldBe true
        }
    }
})
