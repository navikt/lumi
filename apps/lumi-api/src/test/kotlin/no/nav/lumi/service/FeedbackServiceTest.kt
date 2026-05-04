package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.nulls.shouldNotBeNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import no.nav.lumi.TestDatabase
import no.nav.lumi.config.DatabaseHolder
import no.nav.lumi.insertTestFeedback
import no.nav.lumi.insertTestFeedbackWithJson
import no.nav.lumi.repository.FeedbackRepository
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
            
            val id = service.save(feedbackJson, "flex", "test-app")
            
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
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

            val id = service.save(feedbackJson, "flex", "test-app")
            val saved = repository.findRawById(id, "flex").shouldNotBeNull()
            saved.feedbackJson shouldNotContain "01020349294"
            saved.feedbackJson shouldContain "[FØDSELSNUMMER FJERNET]"
            saved.feedbackJson shouldContain "\"clean\""

            val savedJson = Json.parseToJsonElement(saved.feedbackJson).jsonObject
            savedJson["sensitiveDataRedacted"]?.jsonPrimitive?.content shouldBe "true"
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
