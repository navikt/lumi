package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.configureRateLimiting
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.routes.submissionRoutes
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.service.SurveyDefinitionService
import no.nav.lumi.testModule
import java.util.concurrent.atomic.AtomicInteger

private fun submissionPayloadWithDedup(
    deduplicationKey: String,
    submittedAt: String = "2026-01-10T12:00:12Z",
    text: String = "Bra"
) = """
    {
      "schemaVersion": 1,
      "surveyId": "dp-feedback",
      "surveyType": "rating",
      "submittedAt": "$submittedAt",
      "deduplicationKey": "$deduplicationKey",
      "answers": [
        {
          "fieldId": "feedback",
          "fieldType": "TEXT",
          "question": { "label": "Hvorfor?" },
          "value": { "type": "text", "text": "$text" }
        }
      ]
    }
""".trimIndent()

class SubmissionRoutesTest : FunSpec({
    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.clearAllData()
    }

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
                                                "tags": { "rolle": "privatperson", "uke": 3, "abTest": "A" }
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

    test("should reject structural survey definition changes with 409") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "immutable-survey",
                      "surveyType": "custom",
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

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "immutable-survey",
                      "surveyType": "custom",
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
            val message = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("Survey definition conflict for surveyId=immutable-survey") == true) shouldBe true
            (message?.contains("optionIds [apply] -> [apply, follow-up]") == true) shouldBe true
        }
    }

    test("should accept label-only survey definition changes") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "label-survey",
                      "surveyType": "custom",
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

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "label-survey",
                      "surveyType": "custom",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "answers": [
                        {
                          "fieldId": "task",
                          "fieldType": "SINGLE_CHOICE",
                          "question": {
                            "label": "Hva prøvde du å gjøre?",
                            "options": [{ "id": "apply", "label": "Ny label" }]
                          },
                          "value": { "type": "singleChoice", "selectedOptionId": "apply" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            secondResponse.status shouldBe HttpStatusCode.Created
        }
    }

    test("should widen stored definition when later v1 submissions answer more fields") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "subset-survey",
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
                )
            }

            firstResponse.status shouldBe HttpStatusCode.Created

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "subset-survey",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "answers": [
                        {
                          "fieldId": "rating",
                          "fieldType": "RATING",
                          "question": { "label": "Hvor fornøyd er du?" },
                          "value": { "type": "rating", "rating": 5, "ratingVariant": "emoji", "ratingScale": 5 }
                        },
                        {
                          "fieldId": "reason",
                          "fieldType": "TEXT",
                          "question": { "label": "Hvorfor?" },
                          "value": { "type": "text", "text": "Fordi" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            secondResponse.status shouldBe HttpStatusCode.Created
        }
    }

    test("should return 409 when overlapping field changes after definition widening") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "subset-conflict-survey",
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
                )
            }.status shouldBe HttpStatusCode.Created

            client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "subset-conflict-survey",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "answers": [
                        {
                          "fieldId": "rating",
                          "fieldType": "RATING",
                          "question": { "label": "Hvor fornøyd er du?" },
                          "value": { "type": "rating", "rating": 5, "ratingVariant": "emoji", "ratingScale": 5 }
                        },
                        {
                          "fieldId": "reason",
                          "fieldType": "TEXT",
                          "question": { "label": "Hvorfor?" },
                          "value": { "type": "text", "text": "Fordi" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }.status shouldBe HttpStatusCode.Created

            val conflictResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "subset-conflict-survey",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:02:12Z",
                      "answers": [
                        {
                          "fieldId": "reason",
                          "fieldType": "SINGLE_CHOICE",
                          "question": {
                            "label": "Hvorfor?",
                            "options": [{ "id": "a", "label": "A" }]
                          },
                          "value": { "type": "singleChoice", "selectedOptionId": "a" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            conflictResponse.status shouldBe HttpStatusCode.Conflict
            val message = Json.parseToJsonElement(conflictResponse.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content
            (message?.contains("fieldType TEXT -> SINGLE_CHOICE") == true) shouldBe true
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

    test("should reject submissions with null context tag values") {
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
                    "tags": {
                      "rolle": null
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
            (message?.contains("context.tags values must be non-blank", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should accept https context url on external domain") {
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
                    "url": "https://example.org/soknad"
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

            response.status shouldBe HttpStatusCode.Created
        }
    }

    test("should reject non-https context url") {
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
                    "url": "http://www.nav.no/soknad"
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
            (message?.contains("context.url must use https scheme", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject malformed context url") {
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
                    "url": "https://"
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
            (message?.contains("context.url", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject context url containing credentials") {
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
                    "url": "https://user:pass@nav.no/path"
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
            (message?.contains("context.url must not contain credentials", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject invalid context pathname") {
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
                    "pathname": "soknad"
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
            (message?.contains("context.pathname must start with /", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long context pathname") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongPathname = "/" + "p".repeat(2_048)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "context": {
                    "pathname": "$tooLongPathname"
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
            (message?.contains("context.pathname max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long context userAgent") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongUserAgent = "u".repeat(1_001)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "context": {
                    "userAgent": "$tooLongUserAgent"
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
            (message?.contains("context.userAgent max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long answers.fieldId") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongFieldId = "f".repeat(201)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "$tooLongFieldId",
                      "fieldType": "TEXT",
                      "question": { "label": "Hvorfor?" },
                      "value": { "type": "text", "text": "ok" }
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
            (message?.contains("answers.fieldId max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long answers.question.label") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongLabel = "l".repeat(501)
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
                      "question": { "label": "$tooLongLabel" },
                      "value": { "type": "text", "text": "ok" }
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
            (message?.contains("answers.question.label max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long answers.question.options.label") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongOptionLabel = "o".repeat(501)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "custom",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "task",
                      "fieldType": "SINGLE_CHOICE",
                      "question": {
                        "label": "Hva prøvde du å gjøre?",
                        "options": [
                          { "id": "a", "label": "$tooLongOptionLabel" }
                        ]
                      },
                      "value": { "type": "singleChoice", "selectedOptionId": "a" }
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
            (message?.contains("answers.question.options.label max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long answers.question.description") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongDescription = "d".repeat(2_001)
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
                      "question": { "label": "Hvorfor?", "description": "$tooLongDescription" },
                      "value": { "type": "text", "text": "ok" }
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
            (message?.contains("answers.question.description max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long answers.question.options.id") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongOptionId = "i".repeat(201)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "custom",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "task",
                      "fieldType": "SINGLE_CHOICE",
                      "question": {
                        "label": "Hva prøvde du å gjøre?",
                        "options": [
                          { "id": "$tooLongOptionId", "label": "A" }
                        ]
                      },
                      "value": { "type": "singleChoice", "selectedOptionId": "a" }
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
            (message?.contains("answers.question.options.id max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long selectedOptionId") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongSelectedOptionId = "s".repeat(201)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "custom",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "task",
                      "fieldType": "SINGLE_CHOICE",
                      "question": { "label": "Hva prøvde du å gjøre?" },
                      "value": { "type": "singleChoice", "selectedOptionId": "$tooLongSelectedOptionId" }
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
            (message?.contains("selectedOptionId max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject blank selectedOptionIds entry") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "custom",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "choices",
                      "fieldType": "MULTI_CHOICE",
                      "question": { "label": "Hva er viktigst?" },
                      "value": { "type": "multiChoice", "selectedOptionIds": ["ok", " "] }
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
            (message?.contains("selectedOptionIds must be non-blank", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should reject too long selectedOptionIds entry") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val tooLongSelectedId = "m".repeat(201)
            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "custom",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "answers": [
                    {
                      "fieldId": "choices",
                      "fieldType": "MULTI_CHOICE",
                      "question": { "label": "Hva er viktigst?" },
                      "value": { "type": "multiChoice", "selectedOptionIds": ["ok", "$tooLongSelectedId"] }
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
            (message?.contains("selectedOptionIds max length", ignoreCase = true) == true) shouldBe true
        }
    }

    test("should return 200 duplicate with existing id when deduplicationKey is reused") {
        val repository = FeedbackRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadWithDedup("client-key-123456"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            val firstBody = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject
            val id = firstBody["id"]?.jsonPrimitive?.content!!

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadWithDedup(
                        deduplicationKey = "client-key-123456",
                        submittedAt = "2026-01-10T12:01:12Z",
                        text = "Annen tekst"
                    )
                )
            }

            secondResponse.status shouldBe HttpStatusCode.OK
            val secondBody = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject
            secondBody["id"]?.jsonPrimitive?.content shouldBe id
            secondBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val saved = repository.findRawById(id, "local-dev")
            saved?.feedbackJson?.contains("deduplicationKey") shouldBe false
            saved?.feedbackJson?.contains("Bra") shouldBe true
            saved?.feedbackJson?.contains("Annen tekst") shouldBe false

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 1
        }
    }

    test("should return 200 duplicate instead of 409 when same deduplicationKey reuses conflicting survey definition") {
        val feedbackRepository = FeedbackRepository()
        val surveyDefinitionRepository = SurveyDefinitionRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-conflict-survey",
                      "surveyType": "custom",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
            val existingId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!

            val storedBefore = surveyDefinitionRepository.findByTeamAndSurveyId("local-dev", "dedup-conflict-survey")!!

            val duplicateResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-conflict-survey",
                      "surveyType": "custom",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "deduplicationKey": "client-key-123456",
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

            duplicateResponse.status shouldBe HttpStatusCode.OK
            val duplicateBody = Json.parseToJsonElement(duplicateResponse.bodyAsText()).jsonObject
            duplicateBody["id"]?.jsonPrimitive?.content shouldBe existingId
            duplicateBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val storedAfter = surveyDefinitionRepository.findByTeamAndSurveyId("local-dev", "dedup-conflict-survey")!!
            storedAfter.definitionHash shouldBe storedBefore.definitionHash
            storedAfter.definition.fields.single().optionIds shouldBe listOf("apply")

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 1
        }
    }

    test("should still return 409 when a new deduplicationKey sends a conflicting survey definition") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-new-key-conflict-survey",
                      "surveyType": "custom",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
            }.status shouldBe HttpStatusCode.Created

            val conflictResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-new-key-conflict-survey",
                      "surveyType": "custom",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "deduplicationKey": "client-key-654321",
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

            conflictResponse.status shouldBe HttpStatusCode.Conflict
        }
    }

    test("should still extend survey definition when deduplicationKey is new") {
        val feedbackRepository = FeedbackRepository()
        val surveyDefinitionRepository = SurveyDefinitionRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-extension-survey",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
                      "answers": [
                        {
                          "fieldId": "feedback",
                          "fieldType": "TEXT",
                          "question": { "label": "Hvorfor?" },
                          "value": { "type": "text", "text": "Første payload" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }.status shouldBe HttpStatusCode.Created

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dedup-extension-survey",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "deduplicationKey": "client-key-654321",
                      "answers": [
                        {
                          "fieldId": "feedback",
                          "fieldType": "TEXT",
                          "question": { "label": "Hvorfor?" },
                          "value": { "type": "text", "text": "Andre payload" }
                        },
                        {
                          "fieldId": "followup",
                          "fieldType": "TEXT",
                          "question": { "label": "Hva kunne vært bedre?" },
                          "value": { "type": "text", "text": "Mer hjelp" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            secondResponse.status shouldBe HttpStatusCode.Created

            val stored = surveyDefinitionRepository.findByTeamAndSurveyId("local-dev", "dedup-extension-survey")!!
            stored.definition.fields.map { it.fieldId } shouldBe listOf("feedback", "followup")

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 2
        }
    }

    test("should return 400 for invalid deduplication keys without echoing raw value") {
        testApplication {
            application { testModule() }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadWithDedup("bad key with spaces"))
            }

            response.status shouldBe HttpStatusCode.BadRequest
            val message = Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content!!
            message.contains("deduplicationKey") shouldBe true
            message.contains("bad key with spaces") shouldBe false
        }
    }

    test("should keep creating new rows when deduplicationKey is absent") {
        val repository = FeedbackRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

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
                      "value": { "type": "text", "text": "Lik payload" }
                    }
                  ]
                }
            """.trimIndent()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload.replace("12:00:12Z", "12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val firstId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content
            val secondId = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content
            (firstId == secondId) shouldBe false

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 2
        }
    }

    test("should not persist malformed json with root deduplicationKey") {
        val repository = FeedbackRepository()

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
                      "deduplicationKey": "client-key-123456",
                      "answers": [
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldNotContain "client-key-123456"

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 0
        }
    }

    test("should accept explicit deduplicationKey null as absent") {
        val repository = FeedbackRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "dp-feedback",
                  "surveyType": "rating",
                  "submittedAt": "2026-01-10T12:00:12Z",
                  "deduplicationKey": null,
                  "answers": [
                    {
                      "fieldId": "feedback",
                      "fieldType": "TEXT",
                      "question": { "label": "Hvorfor?" },
                      "value": { "type": "text", "text": "Lik payload" }
                    }
                  ]
                }
            """.trimIndent()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload)
            }

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(payload.replace("12:00:12Z", "12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val firstId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!
            val secondId = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!
            (firstId == secondId) shouldBe false

            repository.findRawById(firstId, "local-dev")?.feedbackJson shouldNotContain "deduplicationKey"
            repository.findRawById(secondId, "local-dev")?.feedbackJson shouldNotContain "deduplicationKey"
        }
    }

    test("should treat same deduplicationKey on different surveyIds as separate submissions") {
        val repository = FeedbackRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadWithDedup("client-key-123456"))
            }

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadWithDedup("client-key-123456").replace("\"dp-feedback\"", "\"dp-feedback-2\""))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 2
        }
    }

    test("should handle concurrent duplicate submissions without 500 and persist one row") {
        val repository = FeedbackRepository()

        testApplication {
            application { testModule() }
            val client = createTestClient()

            val responses = coroutineScope {
                (1..4).map { index ->
                    async(Dispatchers.Default) {
                        client.post("/api/tokenx/v1/feedback") {
                            contentType(ContentType.Application.Json)
                            setBody(
                                submissionPayloadWithDedup(
                                    deduplicationKey = "client-key-123456",
                                    submittedAt = "2026-01-10T12:0${index}:12Z",
                                    text = "payload-$index"
                                )
                            )
                        }
                    }
                }.awaitAll()
            }

            responses.count { it.status == HttpStatusCode.Created } shouldBe 1
            responses.count { it.status == HttpStatusCode.OK } shouldBe 3

            val ids = responses.map { response ->
                Json.parseToJsonElement(response.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content
            }.toSet()
            ids.size shouldBe 1

            val duplicateFlags = responses
                .filter { it.status == HttpStatusCode.OK }
                .map { Json.parseToJsonElement(it.bodyAsText()).jsonObject["duplicate"]?.jsonPrimitive?.boolean }
            duplicateFlags.all { it == true } shouldBe true

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 1
        }
    }

    test("should return duplicate instead of 409 for concurrent conflicting definition with same deduplicationKey") {
        val feedbackRepository = FeedbackRepository()
        val surveyDefinitionRepository = SurveyDefinitionRepository()
        val feedbackService = FeedbackService(feedbackRepository)
        val surveyDefinitionService = SurveyDefinitionService(surveyDefinitionRepository)
        val lockAcquired = CompletableDeferred<Unit>()
        val releaseFirstRequest = CompletableDeferred<Unit>()
        val lockInvocationCount = AtomicInteger(0)
        val submissionService = SubmissionService(
            feedbackService = feedbackService,
            surveyDefinitionService = surveyDefinitionService,
            feedbackRepository = feedbackRepository,
            afterScopedDeduplicationLockAcquired = {
                if (lockInvocationCount.incrementAndGet() == 1) {
                    lockAcquired.complete(Unit)
                    releaseFirstRequest.await()
                }
            }
        )

        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                routing {
                    submissionRoutes(
                        feedbackService = feedbackService,
                        surveyDefinitionService = surveyDefinitionService,
                        submissionService = submissionService
                    )
                }
            }
            val client = createTestClient()

            val responses = coroutineScope {
                val first = async(Dispatchers.Default) {
                    client.post("/api/tokenx/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "dedup-race-conflict-survey",
                              "surveyType": "custom",
                              "submittedAt": "2026-01-10T12:00:12Z",
                              "deduplicationKey": "client-key-123456",
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
                }
                lockAcquired.await()
                val second = async(Dispatchers.Default) {
                    client.post("/api/tokenx/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "dedup-race-conflict-survey",
                              "surveyType": "custom",
                              "submittedAt": "2026-01-10T12:01:12Z",
                              "deduplicationKey": "client-key-123456",
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
                }
                releaseFirstRequest.complete(Unit)
                awaitAll(first, second)
            }

            responses.count { it.status == HttpStatusCode.Created } shouldBe 1
            responses.count { it.status == HttpStatusCode.OK } shouldBe 1
            responses.any { it.status == HttpStatusCode.Conflict } shouldBe false

            val createdId = Json.parseToJsonElement(
                responses.single { it.status == HttpStatusCode.Created }.bodyAsText()
            ).jsonObject["id"]?.jsonPrimitive?.content!!
            val duplicateBody = Json.parseToJsonElement(
                responses.single { it.status == HttpStatusCode.OK }.bodyAsText()
            ).jsonObject
            duplicateBody["id"]?.jsonPrimitive?.content shouldBe createdId
            duplicateBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val stored = surveyDefinitionRepository.findByTeamAndSurveyId("local-dev", "dedup-race-conflict-survey")!!
            stored.definition.fields.single().optionIds shouldBe listOf("apply")

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 1
        }
    }

    test("should not mutate survey definition for concurrent duplicate extension with same deduplicationKey") {
        val feedbackRepository = FeedbackRepository()
        val surveyDefinitionRepository = SurveyDefinitionRepository()
        val feedbackService = FeedbackService(feedbackRepository)
        val surveyDefinitionService = SurveyDefinitionService(surveyDefinitionRepository)
        val lockAcquired = CompletableDeferred<Unit>()
        val releaseFirstRequest = CompletableDeferred<Unit>()
        val lockInvocationCount = AtomicInteger(0)
        val submissionService = SubmissionService(
            feedbackService = feedbackService,
            surveyDefinitionService = surveyDefinitionService,
            feedbackRepository = feedbackRepository,
            afterScopedDeduplicationLockAcquired = {
                if (lockInvocationCount.incrementAndGet() == 1) {
                    lockAcquired.complete(Unit)
                    releaseFirstRequest.await()
                }
            }
        )

        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                configureRateLimiting()
                routing {
                    submissionRoutes(
                        feedbackService = feedbackService,
                        surveyDefinitionService = surveyDefinitionService,
                        submissionService = submissionService
                    )
                }
            }
            val client = createTestClient()

            val responses = coroutineScope {
                val first = async(Dispatchers.Default) {
                    client.post("/api/tokenx/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "dedup-race-extension-survey",
                              "surveyType": "rating",
                              "submittedAt": "2026-01-10T12:00:12Z",
                              "deduplicationKey": "client-key-123456",
                              "answers": [
                                {
                                  "fieldId": "feedback",
                                  "fieldType": "TEXT",
                                  "question": { "label": "Hvorfor?" },
                                  "value": { "type": "text", "text": "Første payload" }
                                }
                              ]
                            }
                            """.trimIndent()
                        )
                    }
                }
                lockAcquired.await()
                val second = async(Dispatchers.Default) {
                    client.post("/api/tokenx/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "dedup-race-extension-survey",
                              "surveyType": "rating",
                              "submittedAt": "2026-01-10T12:01:12Z",
                              "deduplicationKey": "client-key-123456",
                              "answers": [
                                {
                                  "fieldId": "feedback",
                                  "fieldType": "TEXT",
                                  "question": { "label": "Hvorfor?" },
                                  "value": { "type": "text", "text": "Andre payload" }
                                },
                                {
                                  "fieldId": "followup",
                                  "fieldType": "TEXT",
                                  "question": { "label": "Hva kunne vært bedre?" },
                                  "value": { "type": "text", "text": "Mer hjelp" }
                                }
                              ]
                            }
                            """.trimIndent()
                        )
                    }
                }
                releaseFirstRequest.complete(Unit)
                awaitAll(first, second)
            }

            responses.count { it.status == HttpStatusCode.Created } shouldBe 1
            responses.count { it.status == HttpStatusCode.OK } shouldBe 1

            val createdId = Json.parseToJsonElement(
                responses.single { it.status == HttpStatusCode.Created }.bodyAsText()
            ).jsonObject["id"]?.jsonPrimitive?.content!!
            val duplicateBody = Json.parseToJsonElement(
                responses.single { it.status == HttpStatusCode.OK }.bodyAsText()
            ).jsonObject
            duplicateBody["id"]?.jsonPrimitive?.content shouldBe createdId
            duplicateBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val stored = surveyDefinitionRepository.findByTeamAndSurveyId("local-dev", "dedup-race-extension-survey")!!
            stored.definition.fields.map { it.fieldId } shouldBe listOf("feedback")

            val saved = feedbackRepository.findRawById(createdId, "local-dev")
            saved?.feedbackJson?.contains("Første payload") shouldBe true
            saved?.feedbackJson?.contains("Andre payload") shouldBe false
            saved?.feedbackJson?.contains("followup") shouldBe false

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "local-dev"))
            total shouldBe 1
        }
    }
})
