package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.service.FeedbackService
import no.nav.lumi.service.SubmissionOutcome
import no.nav.lumi.service.SubmissionService
import no.nav.lumi.service.SurveyDefinitionService
import java.util.concurrent.atomic.AtomicInteger

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

private fun validPayloadWithDedup(
    deduplicationKey: String,
    submittedAt: String = "2026-01-10T12:00:12Z",
    text: String = "Bra"
) = """
{
  "schemaVersion": 1,
  "surveyId": "modia-feedback",
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

private fun validPayloadV2(
    submittedAt: String = "2026-01-10T12:00:12Z",
    deduplicationKey: String = "client-key-123456"
) = """
{
  "schemaVersion": 2,
  "surveyId": "modia-feedback-v2",
  "surveyType": "rating",
  "submittedAt": "$submittedAt",
  "deduplicationKey": "$deduplicationKey",
  "definition": {
    "surveyType": "rating",
    "fields": [
      {
        "fieldId": "feedback",
        "fieldType": "TEXT"
      }
    ]
  },
  "answers": [
    {
      "fieldId": "feedback",
      "fieldType": "TEXT",
      "question": { "label": "Hvorfor?" },
      "value": { "type": "text", "text": "Bra" }
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

    test("should accept valid schemaVersion 2 payload on internal route") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2")

        testApplication {
            application {
                configureSerialization()
                configureStatusPages()
                routing {
                    internalSubmissionRoutes(
                        submissionService = submissionService,
                        submissionKey = TEST_PSK
                    )
                }
            }

            val response = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayloadV2())
            }

            response.status shouldBe HttpStatusCode.Created
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content shouldBe "created-v2"
            coVerify(exactly = 1) {
                submissionService.submit(
                    any(),
                    "teamsykefravr",
                    "syfomodiaperson",
                    match {
                        it.schemaVersion == 2 &&
                            it.surveyId == "modia-feedback-v2" &&
                            it.deduplicationKey == "client-key-123456"
                    },
                    match {
                        it.surveyId == "modia-feedback-v2" &&
                            it.surveyType.name == "RATING" &&
                            it.fields.map { field -> field.fieldId } == listOf("feedback")
                    }
                )
            }
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

    test("should return 200 duplicate with existing id and never persist raw deduplicationKey") {
        val repository = FeedbackRepository()

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
                setBody(validPayloadWithDedup("client-key-123456"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            val firstBody = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject
            val id = firstBody["id"]?.jsonPrimitive?.content!!

            val secondResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayloadWithDedup("client-key-123456", submittedAt = "2026-01-10T12:01:12Z", text = "Annen tekst"))
            }

            secondResponse.status shouldBe HttpStatusCode.OK
            val secondBody = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject
            secondBody["id"]?.jsonPrimitive?.content shouldBe id
            secondBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val saved = repository.findRawById(id, "teamsykefravr")
            saved?.feedbackJson?.contains("deduplicationKey") shouldBe false
            saved?.feedbackJson?.contains("Bra") shouldBe true
            saved?.feedbackJson?.contains("Annen tekst") shouldBe false

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            total shouldBe 1
        }
    }

    test("should return 200 duplicate without mutating survey definition when duplicate adds a new field") {
        val feedbackRepository = FeedbackRepository()
        val surveyDefinitionRepository = SurveyDefinitionRepository()

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
                      "surveyId": "modia-dedup-extension-survey",
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

            firstResponse.status shouldBe HttpStatusCode.Created
            val existingId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!

            val storedBefore = surveyDefinitionRepository.findByTeamAndSurveyId("teamsykefravr", "modia-dedup-extension-survey")!!

            val duplicateResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "modia-dedup-extension-survey",
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

            duplicateResponse.status shouldBe HttpStatusCode.OK
            val duplicateBody = Json.parseToJsonElement(duplicateResponse.bodyAsText()).jsonObject
            duplicateBody["id"]?.jsonPrimitive?.content shouldBe existingId
            duplicateBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true

            val storedAfter = surveyDefinitionRepository.findByTeamAndSurveyId("teamsykefravr", "modia-dedup-extension-survey")!!
            storedAfter.definitionHash shouldBe storedBefore.definitionHash
            storedAfter.definition.fields.map { it.fieldId } shouldBe listOf("feedback")

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            total shouldBe 1
        }
    }

    test("should return 200 duplicate instead of 409 for concurrent conflicting definition on internal route") {
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
                routing {
                    internalSubmissionRoutes(
                        feedbackService = feedbackService,
                        surveyDefinitionService = surveyDefinitionService,
                        submissionService = submissionService,
                        submissionKey = TEST_PSK
                    )
                }
            }

            val responses = coroutineScope {
                val first = async(Dispatchers.Default) {
                    client.post("/api/internal/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        header("X-Lumi-Submission-Key", TEST_PSK)
                        header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "modia-dedup-race-conflict-survey",
                              "surveyType": "topTasks",
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
                    client.post("/api/internal/v1/feedback") {
                        contentType(ContentType.Application.Json)
                        header("X-Lumi-Submission-Key", TEST_PSK)
                        header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                        setBody(
                            """
                            {
                              "schemaVersion": 1,
                              "surveyId": "modia-dedup-race-conflict-survey",
                              "surveyType": "topTasks",
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

            val stored = surveyDefinitionRepository.findByTeamAndSurveyId("teamsykefravr", "modia-dedup-race-conflict-survey")!!
            stored.definition.fields.single().optionIds shouldBe listOf("apply")

            val (_, total, _) = feedbackRepository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            total shouldBe 1
        }
    }

    test("should return 400 for invalid deduplication keys without echoing raw value") {
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
                setBody(validPayloadWithDedup("bad key with spaces"))
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
                setBody(validPayload)
            }

            val secondResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(validPayload.replace("12:00:12Z", "12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val firstId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content
            val secondId = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content
            (firstId == secondId) shouldBe false

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            total shouldBe 2
        }
    }

    test("should treat same deduplicationKey on different teams as separate submissions") {
        val repository = FeedbackRepository()

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
                setBody(validPayloadWithDedup("client-key-123456"))
            }

            val secondResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", "dev-gcp:flex:syfomodiaperson")
                setBody(validPayloadWithDedup("client-key-123456", submittedAt = "2026-01-10T12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val (_, teamOneTotal, _) = repository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            val (_, teamTwoTotal, _) = repository.findPaginated(FeedbackQuery(team = "flex"))
            teamOneTotal shouldBe 1
            teamTwoTotal shouldBe 1
        }
    }

    test("should not persist malformed json with root deduplicationKey") {
        val repository = FeedbackRepository()

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
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "modia-feedback",
                      "surveyType": "rating",
                      "deduplicationKey": "client-key-123456",
                      "answers": [
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldNotContain "client-key-123456"

            val (_, total, _) = repository.findPaginated(FeedbackQuery(team = "teamsykefravr"))
            total shouldBe 0
        }
    }

    test("should accept explicit deduplicationKey null as absent") {
        val repository = FeedbackRepository()

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

            val payload = """
                {
                  "schemaVersion": 1,
                  "surveyId": "modia-feedback",
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

            val firstResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(payload)
            }

            val secondResponse = client.post("/api/internal/v1/feedback") {
                contentType(ContentType.Application.Json)
                header("X-Lumi-Submission-Key", TEST_PSK)
                header("X-Lumi-Caller-Identity", VALID_IDENTITY)
                setBody(payload.replace("12:00:12Z", "12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.Created

            val firstId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!
            val secondId = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!
            (firstId == secondId) shouldBe false

            repository.findRawById(firstId, "teamsykefravr")?.feedbackJson shouldNotContain "deduplicationKey"
            repository.findRawById(secondId, "teamsykefravr")?.feedbackJson shouldNotContain "deduplicationKey"
        }
    }
})
