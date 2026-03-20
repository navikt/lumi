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

        test("strips html tags in text answers and context before storage") {
            val feedbackJson = """
                {
                    "context": {
                        "url": "https://www.nav.no/<b>soknad</b>",
                        "pathname": "/<i>arbeid</i>",
                        "userAgent": "<script>bot</script>Mozilla",
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

            saved.feedbackJson shouldNotContain "<b>"
            saved.feedbackJson shouldNotContain "<script>"
            saved.feedbackJson shouldContain "\"text\":\"Hei team\""
            saved.feedbackJson shouldContain "\"pathname\":\"/arbeid\""
            saved.feedbackJson shouldContain "\"userAgent\":\"botMozilla\""
            saved.feedbackJson shouldContain "\"segment\":\"intern\""
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
