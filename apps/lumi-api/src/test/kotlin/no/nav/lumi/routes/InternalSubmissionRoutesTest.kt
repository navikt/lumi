package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.service.FeedbackService

private const val TEST_PSK = "test-internal-submission-key"
private const val VALID_IDENTITY = "dev-gcp:teamsykefravr:syfomodiaperson"

private val validPayload = """
{
  "schemaVersion": 1,
  "surveyId": "modia-feedback",
  "surveyType": "rating",
  "submittedAt": "2026-01-10T12:00:12Z",
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

class InternalSubmissionRoutesTest : FunSpec({

    beforeSpec { TestDatabase.initialize() }
    beforeTest {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.clearAllData()
    }

    test("should accept valid internal submission with correct PSK and identity") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.Created
            val parsed = Json.parseToJsonElement(response.bodyAsText()).jsonObject
            parsed["id"]?.jsonPrimitive?.content?.isNotBlank() shouldBe true
        }
    }

    test("should apply immutable definition validation on internal route") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val firstResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "internal-immutable",
                      "surveyType": "topTasks",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "answers": [
                        {
                          "fieldId": "task",
                          "fieldType": "SINGLE_CHOICE",
                          "question": {
                            "label": "Hva gjorde du?",
                            "options": [{ "id": "apply", "label": "Søknad" }]
                          },
                          "value": { "type": "singleChoice", "selectedOptionId": "apply" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            firstResponse.status shouldBe HttpStatusCode.Created

            val secondResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "internal-immutable",
                      "surveyType": "topTasks",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "answers": [
                        {
                          "fieldId": "task",
                          "fieldType": "SINGLE_CHOICE",
                          "question": {
                            "label": "Hva gjorde du?",
                            "options": [
                              { "id": "apply", "label": "Søknad" },
                              { "id": "follow-up", "label": "Oppfølging" }
                            ]
                          },
                          "value": { "type": "singleChoice", "selectedOptionId": "apply" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            secondResponse.status shouldBe HttpStatusCode.Conflict
        }
    }

    test("should return 401 when PSK is missing") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("should return 401 when PSK is incorrect") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", "wrong-key")
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("should return 400 when caller identity header is missing") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("should return 400 when caller identity has invalid format") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", "invalid-format")
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("should return 400 for invalid JSON body") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody("not valid json")
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("should return 400 for payload with empty answers") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody("""
                    {
                      "schemaVersion": 1,
                      "surveyId": "modia-feedback",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "answers": []
                    }
                """.trimIndent())
            }

            response.status shouldBe HttpStatusCode.BadRequest
        }
    }

    test("should return 413 when payload exceeds 1MB limit") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = TEST_PSK
                    )
                }
            }

            val largeText = "a".repeat(1_100_000)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "modia-feedback",
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

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(payload)
            }

            response.status shouldBe HttpStatusCode.PayloadTooLarge
        }
    }

    test("should return 404 when internal routes are disabled (no key)") {
        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        feedbackService = FeedbackService(),
                        submissionKey = null
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayload)
            }

            response.status shouldBe HttpStatusCode.NotFound
        }
    }
})
