package no.nav.lumi.service

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.collections.shouldContain as collectionShouldContain
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.nulls.shouldNotBeNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.createdId
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.service.computeDeduplicationKeyHash
import java.util.UUID

class FeedbackServiceTest : FunSpec({

    val repository = FeedbackRepository()
    val service = FeedbackService(repository)

    beforeSpec {
        DatabaseHolder.initializeForTesting(TestDatabase.dataSource)
        TestDatabase.initialize()
    }

    beforeTest {
        TestDatabase.clearAllData()
    }

    context("save with redaction") {
        test("redacts sensitive data in feedback JSON") {
            val feedbackJson = """
                {
                    "answers": [
                        {
                            "fieldId": "text-answer",
                            "value": {
                                "type": "text",
                                "text": "Mitt fødselsnummer er 01020349294"
                            }
                        }
                    ]
                }
            """.trimIndent()
            
            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"

            // Persisted flag for robust UI/export indication
            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"

            // And the DTO mapping should expose it
            val dto = repository.findById(id, "flex").shouldNotBeNull()
            dto.sensitiveDataRedacted shouldBe true
        }

        test("preserves html in text answers but strips html tags from context before storage") {
            val feedbackJson = """
                {
                    "context": {
                        "url": "https://www.nav.no/<script>test</script>",
                        "pathname": "/<i>arbeid</i>",
                        "userAgent": "bot<img>Mozilla",
                        "tags": {
                            "segment": "<b>intern</b>"
                        }
                    },
                    "answers": [
                        {
                            "fieldId": "text-answer",
                            "value": {
                                "type": "text",
                                "text": "Hei <b>team</b>"
                            }
                        }
                    ]
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()

            saved.feedbackJson shouldContain "Hei <b>team</b>"
            saved.feedbackJson shouldNotContain "<script>test</script>"
            saved.feedbackJson shouldNotContain "<img>"
            saved.feedbackJson shouldContain "\"pathname\": \"/arbeid\""
            saved.feedbackJson shouldContain "\"userAgent\": \"botMozilla\""
            saved.feedbackJson shouldContain "\"segment\": \"intern\""
        }

        test("redacts fødselsnummer in URL query parameter") {
            val feedbackJson = """
                {
                    "context": {
                        "url": "https://nav.no/sok?soek=01020349294&page=1"
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()

            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "soek="

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("redacts fødselsnummer in URL path") {
            val feedbackJson = """
                {
                    "context": {
                        "url": "https://nav.no/bruker/01020349294/status"
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "%5BF%C3%98DSELSNUMMER%20FJERNET%5D"
        }

        test("redacts PII in tag values") {
            val feedbackJson = """
                {
                    "context": {
                        "tags": {
                            "team": "flex",
                            "bruker": "01020349294"
                        }
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"
            saved.feedbackJson shouldContain "\"team\""
            saved.feedbackJson shouldContain "\"flex\""

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("redacts PII in tag keys") {
            val feedbackJson = """
                {
                    "context": {
                        "tags": {
                            "01020349294": "ja"
                        }
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "REDACTED_KEY"

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("redacts PII in debug recursively") {
            val feedbackJson = """
                {
                    "context": {
                        "debug": {
                            "nested": {
                                "value": "ring 98765432"
                            }
                        }
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "98765432"
            saved.feedbackJson shouldContain "[TELEFON FJERNET]"

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("no redaction leaves sensitiveDataRedacted as false") {
            val feedbackJson = """
                {
                    "context": {
                        "url": "https://nav.no/arbeid",
                        "tags": {"team": "flex"}
                    },
                    "answers": [
                        {
                            "fieldId": "q1",
                            "value": {"type": "text", "text": "Alt er bra"}
                        }
                    ]
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "false"
        }

        test("redacts PII in debug JsonArray") {
            val feedbackJson = """
                {
                    "context": {
                        "debug": [
                            {"fnr": "01020349294"},
                            {"clean": "ok"}
                        ]
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"
            saved.feedbackJson shouldContain "\"clean\""

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }
        test("redacts percent-encoded fødselsnummer in pathname") {
            val feedbackJson = """
                {
                    "context": {
                        "pathname": "/bruker/%30%31%30%32%30%33%34%39%32%39%34/status"
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"
        }

        test("HTML-stripped tag keys that collide do not overwrite each other") {
            val feedbackJson = """
                {
                    "context": {
                        "tags": {
                            "team": "flex",
                            "<b>team</b>": "dagpenger"
                        }
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            val tags = savedJson["context"]?.jsonObject?.get("tags")?.jsonObject
            tags.shouldNotBeNull()
            // Both values should be present (no data loss)
            val values = tags.values.map { it.jsonPrimitive.content }
            values collectionShouldContain "flex"
            values collectionShouldContain "dagpenger"
        }

        test("blank tag keys after HTML stripping are replaced with unique redaction key") {
            val feedbackJson = """
                {
                    "context": {
                        "tags": {
                            "<b></b>": "skjult",
                            "team": "flex"
                        }
                    },
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(feedbackJson, "flex", "test-app").createdId()
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            val tags = savedJson["context"]?.jsonObject?.get("tags")?.jsonObject
            tags.shouldNotBeNull()

            tags.keys.any { it.isBlank() } shouldBe false
            tags.keys.any { it.startsWith("[REDACTED_KEY_") } shouldBe true
            tags.values.map { it.jsonPrimitive.content } collectionShouldContain "skjult"
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
        }

        test("answer redaction failure fails closed with internal server error") {
            val feedbackJson = """
                {
                    "answers": [
                        "ugyldig-svar"
                    ]
                }
            """.trimIndent()

            val exception = shouldThrow<ApiErrorException.InternalServerErrorException> {
                service.save(feedbackJson, "flex", "test-app")
            }

            exception.message shouldBe "Failed to redact feedback JSON"
        }

        test("computes scoped deduplication hash with length-prefixed sha-256") {
            computeDeduplicationKeyHash(
                team = "flex",
                surveyId = "survey-123",
                deduplicationKey = "dedup-key-123456"
            ) shouldBe "1eea9655aab33d16947b8a6c4a2abbf641df30ebcc38c453ec6b2b835e5d9e02"
        }

        test("strips deduplicationKey before persistence and returns duplicate for same team survey and key") {
            val firstPayload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
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
            val secondPayload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:01:12Z",
                    "deduplicationKey": "client-key-123456",
                    "answers": [
                        {
                            "fieldId": "feedback",
                            "fieldType": "TEXT",
                            "question": { "label": "Hvorfor?" },
                            "value": { "type": "text", "text": "Andre payload" }
                        }
                    ]
                }
            """.trimIndent()

            val firstId = service.save(
                feedbackJson = firstPayload,
                team = "flex",
                app = "test-app",
                surveyId = "survey-dedup",
                definitionHash = "a".repeat(64)
            ).createdId()

            val second = service.save(
                feedbackJson = secondPayload,
                team = "flex",
                app = "test-app",
                surveyId = "survey-dedup",
                definitionHash = "a".repeat(64)
            )

            second shouldBe SaveResult.Duplicate(firstId)

            val saved = repository.findRawById(firstId, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "deduplicationKey"
            saved.feedbackJson shouldContain "Første payload"
            saved.feedbackJson shouldNotContain "Andre payload"
        }

        test("strips definition and deduplicationKey before persisting schemaVersion=2 payload") {
            val payload = """
                {
                    "schemaVersion": 2,
                    "surveyId": "survey-v2",
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
                            "value": { "type": "text", "text": "Payload" }
                        }
                    ]
                }
            """.trimIndent()

            val id = service.save(
                feedbackJson = payload,
                team = "flex",
                app = "test-app",
                surveyId = "survey-v2",
                definitionHash = "a".repeat(64)
            ).createdId()

            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "deduplicationKey"
            saved.feedbackJson shouldNotContain "\"definition\""
            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["surveyType"]?.jsonPrimitive?.content shouldBe "rating"
        }

        test("uses provided surveyId for dedup scope when payload surveyId differs") {
            val payload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "payload-survey",
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:00:12Z",
                    "deduplicationKey": "client-key-123456",
                    "answers": [
                        {
                            "fieldId": "feedback",
                            "fieldType": "TEXT",
                            "question": { "label": "Hvorfor?" },
                            "value": { "type": "text", "text": "Payload" }
                        }
                    ]
                }
            """.trimIndent()

            val first = service.save(
                feedbackJson = payload,
                team = "flex",
                app = "test-app",
                surveyId = "service-scope-a",
                definitionHash = "a".repeat(64)
            ).createdId()

            val second = service.save(
                feedbackJson = payload.replace("12:00:12Z", "12:01:12Z"),
                team = "flex",
                app = "test-app",
                surveyId = "service-scope-b",
                definitionHash = "a".repeat(64)
            ).createdId()

            (first == second) shouldBe false

            val firstSaved = repository.findRawById(first, "flex").shouldNotBeNull()
            val secondSaved = repository.findRawById(second, "flex").shouldNotBeNull()
            firstSaved.feedbackJson shouldNotContain "deduplicationKey"
            secondSaved.feedbackJson shouldNotContain "deduplicationKey"

            val (_, total, _) = repository.findPaginated(no.nav.lumi.domain.FeedbackQuery(team = "flex"))
            total shouldBe 2
        }

        test("fails closed when malformed json contains deduplicationKey and persists nothing") {
            val malformedPayload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
                    "surveyType": "rating",
                    "deduplicationKey": "client-key-123456",
                    "answers": [
                }
            """.trimIndent()

            val exception = shouldThrow<ApiErrorException.InternalServerErrorException> {
                service.save(
                    feedbackJson = malformedPayload,
                    team = "flex",
                    app = "test-app",
                    surveyId = "survey-dedup",
                    definitionHash = "a".repeat(64)
                )
            }

            exception.message shouldBe "Failed to redact feedback JSON"
            exception.cause shouldBe null
            val (_, total, _) = repository.findPaginated(no.nav.lumi.domain.FeedbackQuery(team = "flex"))
            total shouldBe 0
        }

        test("treats explicit deduplicationKey null as absent and does not persist the raw field") {
            val payload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:00:12Z",
                    "deduplicationKey": null,
                    "answers": [
                        {
                            "fieldId": "feedback",
                            "fieldType": "TEXT",
                            "question": { "label": "Hvorfor?" },
                            "value": { "type": "text", "text": "Payload" }
                        }
                    ]
                }
            """.trimIndent()

            val firstId = service.save(
                feedbackJson = payload,
                team = "flex",
                app = "test-app",
                surveyId = "survey-dedup",
                definitionHash = "a".repeat(64)
            ).createdId()

            val secondId = service.save(
                feedbackJson = payload.replace("12:00:12Z", "12:01:12Z"),
                team = "flex",
                app = "test-app",
                surveyId = "survey-dedup",
                definitionHash = "a".repeat(64)
            ).createdId()

            (firstId == secondId) shouldBe false

            val firstSaved = repository.findRawById(firstId, "flex").shouldNotBeNull()
            val secondSaved = repository.findRawById(secondId, "flex").shouldNotBeNull()
            firstSaved.feedbackJson shouldNotContain "deduplicationKey"
            secondSaved.feedbackJson shouldNotContain "deduplicationKey"
        }

        test("rejects invalid deduplicationKey format at service boundary without echoing raw value") {
            val payload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:00:12Z",
                    "deduplicationKey": "bad key with spaces",
                    "answers": []
                }
            """.trimIndent()

            val exception = shouldThrow<ApiErrorException.BadRequestException> {
                service.save(
                    feedbackJson = payload,
                    team = "flex",
                    app = "test-app",
                    surveyId = "survey-dedup",
                    definitionHash = "a".repeat(64)
                )
            }

            exception.message shouldContain "deduplicationKey"
            exception.message shouldNotContain "bad key with spaces"
        }

        test("rejects deduplicationKey when surveyId is missing and persists nothing") {
            val payload = """
                {
                    "schemaVersion": 1,
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:00:12Z",
                    "deduplicationKey": "client-key-123456",
                    "answers": []
                }
            """.trimIndent()

            val exception = shouldThrow<ApiErrorException.BadRequestException> {
                service.save(
                    feedbackJson = payload,
                    team = "flex",
                    app = "test-app"
                )
            }

            exception.message shouldBe "Invalid payload: deduplicationKey requires surveyId"
            val (_, total, _) = repository.findPaginated(no.nav.lumi.domain.FeedbackQuery(team = "flex"))
            total shouldBe 0
        }

        test("finds existing duplicate submission id before definition handling") {
            val payload = """
                {
                    "schemaVersion": 1,
                    "surveyId": "survey-dedup",
                    "surveyType": "rating",
                    "submittedAt": "2026-01-10T12:00:12Z",
                    "deduplicationKey": "client-key-123456",
                    "answers": []
                }
            """.trimIndent()

            val id = service.save(
                feedbackJson = payload,
                team = "flex",
                app = "test-app",
                surveyId = "survey-dedup",
                definitionHash = "a".repeat(64)
            ).createdId()

            service.findDuplicateSubmissionId(
                team = "flex",
                surveyId = "survey-dedup",
                deduplicationKey = "client-key-123456"
            ) shouldBe id
        }

        test("findDuplicateSubmissionId rejects invalid deduplicationKey without echoing raw value") {
            val exception = shouldThrow<ApiErrorException.BadRequestException> {
                service.findDuplicateSubmissionId(
                    team = "flex",
                    surveyId = "survey-dedup",
                    deduplicationKey = "bad key with spaces"
                )
            }

            exception.message shouldContain "deduplicationKey"
            exception.message shouldNotContain "bad key with spaces"
        }
    }

    context("delete") {
        test("permanently removes feedback from database") {
            val id = UUID.randomUUID().toString()
            val feedbackJson = """
                {
                    "answers": [
                        {
                            "fieldId": "q1",
                            "fieldType": "TEXT",
                            "value": {"type": "text", "text": "Some feedback"}
                        },
                        {
                            "fieldId": "q2",
                            "fieldType": "RATING",
                            "value": {"type": "rating", "rating": 5}
                        }
                    ]
                }
            """.trimIndent()
            
            insertTestFeedbackWithJson(id = id, team = "flex", feedbackJson = feedbackJson)
            
            // Verify it exists first
            repository.findRawById(id, "flex").shouldNotBeNull()
            
            val result = service.delete(id, "flex")
            
            result shouldBe true
            repository.findRawById(id, "flex") shouldBe null
        }

        test("does not delete feedback from another team") {
            val id = UUID.randomUUID().toString()
            val feedbackJson = """
                {
                    "answers": [
                        {
                            "fieldId": "q1",
                            "fieldType": "TEXT",
                            "value": {"type": "text", "text": "Team secret"}
                        }
                    ]
                }
            """.trimIndent()

            insertTestFeedbackWithJson(id = id, team = "team-a", feedbackJson = feedbackJson)

            val result = service.delete(id, "team-b")

            result shouldBe false
            // Should still exist
            val unchanged = repository.findRawById(id, "team-a")
            unchanged?.feedbackJson shouldContain "Team secret"
        }
    }
})
