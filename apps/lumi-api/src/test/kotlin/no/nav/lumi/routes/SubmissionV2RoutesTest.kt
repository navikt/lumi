package no.nav.lumi.routes

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.testing.testApplication
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.config.configureRateLimiting
import no.nav.lumi.config.configureSerialization
import no.nav.lumi.config.configureStatusPages
import no.nav.lumi.config.SubmissionObservability
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.createTestClient
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.service.SubmissionOutcome
import no.nav.lumi.service.SubmissionService

private fun Application.submissionRoutesTestModule(
    submissionService: SubmissionService,
    submissionObservability: SubmissionObservability? = null
) {
    configureSerialization()
    configureStatusPages()
    if (submissionObservability == null) {
        configureRateLimiting()
    } else {
        configureRateLimiting(submissionObservability)
    }
    routing {
        if (submissionObservability == null) {
            submissionRoutes(submissionService = submissionService)
        } else {
            submissionRoutes(
                submissionService = submissionService,
                submissionObservability = submissionObservability
            )
        }
    }
}

private fun submissionPayloadV2(
    submittedAt: String = "2026-01-10T12:00:12Z",
    deduplicationKey: String = "client-key-123456",
    surveyType: String = "rating",
    definitionSurveyType: String = surveyType,
    definitionFieldId: String = "feedback",
    answerFieldId: String = definitionFieldId
) = """
    {
      "schemaVersion": 2,
      "surveyId": "dp-feedback-v2",
      "surveyType": "$surveyType",
      "submittedAt": "$submittedAt",
      "deduplicationKey": "$deduplicationKey",
      "definition": {
        "surveyType": "$definitionSurveyType",
        "fields": [
          {
            "fieldId": "$definitionFieldId",
            "fieldType": "TEXT"
          }
        ]
      },
      "answers": [
        {
          "fieldId": "$answerFieldId",
          "fieldType": "TEXT",
          "question": { "label": "Hvorfor?" },
          "value": { "type": "text", "text": "Bra" }
        }
      ]
    }
""".trimIndent()

private fun submissionPayloadV2Raw(
    definitionFieldsJson: String,
    answersJson: String
) = """
    {
      "schemaVersion": 2,
      "surveyId": "dp-feedback-v2",
      "surveyType": "rating",
      "submittedAt": "2026-01-10T12:00:12Z",
      "deduplicationKey": "client-key-123456",
      "definition": {
        "surveyType": "rating",
        "fields": $definitionFieldsJson
      },
      "answers": $answersJson
    }
""".trimIndent()

private fun submissionPayloadV2WithFlow() = """
    {
      "schemaVersion": 2,
      "surveyId": "dp-feedback-v2",
      "surveyType": "rating",
      "submittedAt": "2026-01-10T12:00:12Z",
      "deduplicationKey": "client-key-123456",
      "definition": {
        "surveyType": "rating",
        "fields": [{"fieldId": "feedback", "fieldType": "TEXT"}]
      },
      "flow": {
        "schemaVersion": 1,
        "evaluatorVersion": "visible-if-v1",
        "fields": [{"fieldId": "feedback"}]
      },
      "answers": [
        {
          "fieldId": "feedback",
          "fieldType": "TEXT",
          "question": {"label": "Hvorfor?"},
          "value": {"type": "text", "text": "Bra"}
        }
      ]
    }
""".trimIndent()

private fun topTasksPayloadV2(successFieldId: String = "success") = """
    {
      "schemaVersion": 2,
      "surveyId": "top-tasks-contract",
      "surveyType": "topTasks",
      "submittedAt": "2026-01-10T12:00:12Z",
      "deduplicationKey": "top-tasks-contract-key",
      "definition": {
        "surveyType": "topTasks",
        "fields": [
          {
            "fieldId": "task",
            "fieldType": "SINGLE_CHOICE",
            "optionIds": ["apply", "status"]
          },
          {
            "fieldId": "$successFieldId",
            "fieldType": "SINGLE_CHOICE",
            "optionIds": ["yes", "partial", "no"]
          }
        ]
      },
      "answers": [
        {
          "fieldId": "task",
          "fieldType": "SINGLE_CHOICE",
          "question": {
            "label": "Hva prøvde du å gjøre?",
            "options": [
              {"id": "apply", "label": "Søke"},
              {"id": "status", "label": "Sjekke status"}
            ]
          },
          "value": {"type": "singleChoice", "selectedOptionId": "apply"}
        },
        {
          "fieldId": "$successFieldId",
          "fieldType": "SINGLE_CHOICE",
          "question": {
            "label": "Klarte du det?",
            "options": [
              {"id": "yes", "label": "Ja"},
              {"id": "partial", "label": "Delvis"},
              {"id": "no", "label": "Nei"}
            ]
          },
          "value": {"type": "singleChoice", "selectedOptionId": "yes"}
        }
      ]
    }
""".trimIndent()

private fun repeatedTextFieldsJson(count: Int): String =
    (1..count).joinToString(prefix = "[", postfix = "]") { index ->
        """
        {
          "fieldId": "field_$index",
          "fieldType": "TEXT"
        }
        """.trimIndent()
    }

class SubmissionV2RoutesTest : FunSpec({
    test("records a successful TokenX submission") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val submissionObservability = SubmissionObservability(meterRegistry)
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2")

        testApplication {
            application {
                submissionRoutesTestModule(submissionService, submissionObservability)
            }

            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2())
            }

            response.status shouldBe HttpStatusCode.Created
            meterRegistry.get(SubmissionObservability.METRIC_NAME)
                .tag("channel", "tokenx")
                .tag("outcome", "created")
                .counter()
                .count() shouldBe 1.0
        }
    }

    test("records a rejected TokenX submission") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val submissionObservability = SubmissionObservability(meterRegistry)
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application {
                submissionRoutesTestModule(submissionService, submissionObservability)
            }

            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody("{")
            }

            response.status shouldBe HttpStatusCode.BadRequest
            meterRegistry.get(SubmissionObservability.METRIC_NAME)
                .tag("channel", "tokenx")
                .tag("outcome", "rejected")
                .counter()
                .count() shouldBe 1.0
            coVerify(exactly = 0) {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            }
        }
    }

    listOf(
        Triple("TokenX", "/api/tokenx/v1/feedback", "tokenx"),
        Triple("Azure", "/api/azure/v1/feedback", "azure"),
    ).forEach { (issuer, path, channel) ->
        test("records a user rate-limited $issuer submission as rejected") {
            val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
            val submissionObservability = SubmissionObservability(meterRegistry)
            val submissionService = mockk<SubmissionService>()
            coEvery {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            } returns SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2")

            testApplication {
                application {
                    submissionRoutesTestModule(submissionService, submissionObservability)
                }
                val client = createTestClient()

                repeat(15) {
                    val response = client.post(path) {
                        contentType(ContentType.Application.Json)
                        setBody(submissionPayloadV2())
                    }
                    response.status shouldBe HttpStatusCode.Created
                }

                val blockedResponse = client.post(path) {
                    contentType(ContentType.Application.Json)
                    setBody(submissionPayloadV2())
                }

                blockedResponse.status shouldBe HttpStatusCode.TooManyRequests
                meterRegistry.get(SubmissionObservability.METRIC_NAME)
                    .tag("channel", channel)
                    .tag("outcome", "rejected")
                    .counter()
                    .count() shouldBe 1.0
            }
        }
    }

    test("records a successful Azure submission") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val submissionObservability = SubmissionObservability(meterRegistry)
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-azure"), "hash-azure")

        testApplication {
            application {
                submissionRoutesTestModule(submissionService, submissionObservability)
            }

            val response = createTestClient().post("/api/azure/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2())
            }

            response.status shouldBe HttpStatusCode.Created
            meterRegistry.get(SubmissionObservability.METRIC_NAME)
                .tag("channel", "azure")
                .tag("outcome", "created")
                .counter()
                .count() shouldBe 1.0
        }
    }

    test("v1 still works on existing submission endpoint") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-v1"), "hash-v1")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 1,
                      "surveyId": "dp-feedback-v1",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
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
                )
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(any(), "local-dev", "local-app", any(), null, null)
            }
        }
    }

    test("v2 accepts complete definition on existing submission endpoint") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2())
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(
                    any(),
                    "local-dev",
                    "local-app",
                    match { it.schemaVersion == 2 && it.deduplicationKey == "client-key-123456" },
                    match {
                        it.surveyId == "dp-feedback-v2" &&
                            it.surveyType.name == "RATING" &&
                            it.fields.map { field -> field.fieldId } == listOf("feedback")
                    },
                    null,
                )
            }
        }
    }

    test("v2 passes a validated visibleIf flow contract to ingest") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-flow"), "definition-hash", "flow-hash")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2WithFlow())
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(
                    any(),
                    "local-dev",
                    "local-app",
                    any(),
                    any(),
                    match {
                        it.schemaVersion == 1 &&
                            it.evaluatorVersion == "visible-if-v1" &&
                            it.fields.map { field -> field.fieldId } == listOf("feedback")
                    },
                )
            }
        }
    }

    test("v2 rejects an unknown flow evaluator before ingest") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2WithFlow().replace(
                        "visible-if-v1",
                        "visible-if-v2",
                    ),
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            coVerify(exactly = 0) {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            }
        }
    }

    test("v2 accepts the canonical specialized survey contract") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-specialized"), "hash-specialized")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(topTasksPayloadV2())
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            }
        }
    }

    test("v2 accepts the success field emitted by deprecated Top Tasks builders") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-legacy"), "hash-legacy")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val response = createTestClient().post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(topTasksPayloadV2(successFieldId = "taskSuccess"))
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            }
        }
    }

    test("v2 without definition returns 400") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content shouldBe
                "Invalid payload: definition is required for schemaVersion=2"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 without deduplicationKey returns specific 400") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
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
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content shouldBe
                "Invalid payload: deduplicationKey is required for schemaVersion=2"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 without answers returns generic invalid payload") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
                      "definition": {
                        "surveyType": "rating",
                        "fields": [
                          {
                            "fieldId": "feedback",
                            "fieldType": "TEXT"
                          }
                        ]
                      }
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            Json.parseToJsonElement(response.bodyAsText()).jsonObject["message"]?.jsonPrimitive?.content shouldBe
                "Invalid payload"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("non-primitive schemaVersion returns 400") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": { "value": 2 },
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "schemaVersion must be an integer"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("string schemaVersion returns specific 400") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": "2",
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "schemaVersion must be an integer"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects surveyType mismatch between top-level and definition") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2(surveyType = "rating", definitionSurveyType = "topTasks"))
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "surveyType must match definition.surveyType"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects answers whose fieldId is missing from definition") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2(definitionFieldId = "defined-field", answerFieldId = "other-field"))
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "answers.fieldId"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects malformed rating definition before submit") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
                      "definition": {
                        "surveyType": "rating",
                        "fields": [
                          {
                            "fieldId": "rating",
                            "fieldType": "RATING",
                            "ratingVariant": "emoji",
                            "ratingScale": 5,
                            "optionIds": ["unexpected"]
                          }
                        ]
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
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "must not include optionIds"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects answers that conflict with definition before submit") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:00:12Z",
                      "deduplicationKey": "client-key-123456",
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
                          "fieldType": "SINGLE_CHOICE",
                          "question": { "label": "Hvorfor?" },
                          "value": { "type": "singleChoice", "selectedOptionId": "a" }
                        }
                      ]
                    }
                    """.trimIndent()
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "fieldType=SINGLE_CHOICE, expected TEXT"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects definition with too many fields before submit") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2Raw(
                        definitionFieldsJson = repeatedTextFieldsJson(51),
                        answersJson = """
                        [
                          {
                            "fieldId": "field_1",
                            "fieldType": "TEXT",
                            "question": { "label": "Hvorfor?" },
                            "value": { "type": "text", "text": "Bra" }
                          }
                        ]
                        """.trimIndent()
                    )
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "definition.fields max count"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects single choice answer when question options are missing") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2Raw(
                        definitionFieldsJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "SINGLE_CHOICE",
                            "optionIds": ["bug", "feature"]
                          }
                        ]
                        """.trimIndent(),
                        answersJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "SINGLE_CHOICE",
                            "question": { "label": "Kategori?" },
                            "value": { "type": "singleChoice", "selectedOptionId": "bug" }
                          }
                        ]
                        """.trimIndent()
                    )
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "question.options"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 rejects multi choice answer when question options differ from definition") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2Raw(
                        definitionFieldsJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "MULTI_CHOICE",
                            "optionIds": ["bug", "feature"]
                          }
                        ]
                        """.trimIndent(),
                        answersJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "MULTI_CHOICE",
                            "question": {
                              "label": "Kategori?",
                              "options": [
                                { "id": "bug", "label": "Bug" },
                                { "id": "feature", "label": "Feature" },
                                { "id": "other", "label": "Other" }
                              ]
                            },
                            "value": { "type": "multiChoice", "selectedOptionIds": ["bug", "feature"] }
                          }
                        ]
                        """.trimIndent()
                    )
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "definition.optionIds"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 accepts choice answer when question options match definition") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returns SubmissionOutcome(SaveResult.Created("created-choice"), "hash-choice")

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2Raw(
                        definitionFieldsJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "SINGLE_CHOICE",
                            "optionIds": ["bug", "feature"]
                          }
                        ]
                        """.trimIndent(),
                        answersJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "SINGLE_CHOICE",
                            "question": {
                              "label": "Kategori?",
                              "options": [
                                { "id": "bug", "label": "Bug" },
                                { "id": "feature", "label": "Feature" }
                              ]
                            },
                            "value": { "type": "singleChoice", "selectedOptionId": "feature" }
                          }
                        ]
                        """.trimIndent()
                    )
                )
            }

            response.status shouldBe HttpStatusCode.Created
            coVerify(exactly = 1) {
                submissionService.submit(any(), any(), any(), any(), any(), any())
            }
        }
    }

    test("v2 rejects more multi choice answers than maxSelections") {
        val submissionService = mockk<SubmissionService>()

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    submissionPayloadV2Raw(
                        definitionFieldsJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "MULTI_CHOICE",
                            "optionIds": ["bug", "feature"],
                            "maxSelections": 1
                          }
                        ]
                        """.trimIndent(),
                        answersJson = """
                        [
                          {
                            "fieldId": "category",
                            "fieldType": "MULTI_CHOICE",
                            "question": {
                              "label": "Kategori?",
                              "options": [
                                { "id": "bug", "label": "Bug" },
                                { "id": "feature", "label": "Feature" }
                              ]
                            },
                            "value": { "type": "multiChoice", "selectedOptionIds": ["bug", "feature"] }
                          }
                        ]
                        """.trimIndent()
                    )
                )
            }

            response.status shouldBe HttpStatusCode.BadRequest
            response.bodyAsText() shouldContain "exceeds maxSelections=1"
            coVerify(exactly = 0) { submissionService.submit(any(), any(), any(), any(), any(), any()) }
        }
    }

    test("v2 returns 409 when full definition structure changes for same surveyId") {
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } answers {
            if (firstArg<String>().contains("followup")) {
                throw ApiErrorException.ConflictException(
                    "Survey definition conflict for surveyId=dp-feedback-v2: addedFields=[field_1]"
                )
            }
            SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2")
        }

        testApplication {
            application { submissionRoutesTestModule(submissionService) }
            val client = createTestClient()

            client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2())
            }.status shouldBe HttpStatusCode.Created

            val response = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(
                    """
                    {
                      "schemaVersion": 2,
                      "surveyId": "dp-feedback-v2",
                      "surveyType": "rating",
                      "submittedAt": "2026-01-10T12:01:12Z",
                      "deduplicationKey": "client-key-654321",
                      "definition": {
                        "surveyType": "rating",
                        "fields": [
                          {
                            "fieldId": "feedback",
                            "fieldType": "TEXT"
                          },
                          {
                            "fieldId": "followup",
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
                )
            }

            response.status shouldBe HttpStatusCode.Conflict
            response.bodyAsText() shouldContain "addedFields=[field_1]"
            response.bodyAsText() shouldNotContain "followup"
            response.bodyAsText() shouldNotContain "Hvorfor?"
        }
    }

    test("v2 deduplicates retry with same deduplicationKey") {
        val meterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        val submissionObservability = SubmissionObservability(meterRegistry)
        val submissionService = mockk<SubmissionService>()
        coEvery {
            submissionService.submit(any(), any(), any(), any(), any(), any())
        } returnsMany listOf(
            SubmissionOutcome(SaveResult.Created("created-v2"), "hash-v2"),
            SubmissionOutcome(SaveResult.Duplicate("created-v2"))
        )

        testApplication {
            application {
                submissionRoutesTestModule(submissionService, submissionObservability)
            }
            val client = createTestClient()

            val firstResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2())
            }

            val secondResponse = client.post("/api/tokenx/v1/feedback") {
                contentType(ContentType.Application.Json)
                setBody(submissionPayloadV2(submittedAt = "2026-01-10T12:01:12Z"))
            }

            firstResponse.status shouldBe HttpStatusCode.Created
            secondResponse.status shouldBe HttpStatusCode.OK

            val firstId = Json.parseToJsonElement(firstResponse.bodyAsText()).jsonObject["id"]?.jsonPrimitive?.content!!
            val secondBody = Json.parseToJsonElement(secondResponse.bodyAsText()).jsonObject
            secondBody["id"]?.jsonPrimitive?.content shouldBe firstId
            secondBody["duplicate"]?.jsonPrimitive?.boolean shouldBe true
            meterRegistry.get(SubmissionObservability.METRIC_NAME)
                .tag("channel", "tokenx")
                .tag("outcome", "created")
                .counter()
                .count() shouldBe 1.0
            meterRegistry.get(SubmissionObservability.METRIC_NAME)
                .tag("channel", "tokenx")
                .tag("outcome", "duplicate")
                .counter()
                .count() shouldBe 1.0
        }
    }
})
