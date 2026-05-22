package no.nav.lumi.service

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

class FeedbackServicePrepareForSaveTest : FunSpec({
    test("prepareForSave strips definition and raw deduplicationKey from schemaVersion=2 payload") {
        val service = FeedbackService()
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

        val prepared = service.prepareForSave(
            feedbackJson = payload,
            team = "flex",
            surveyId = "survey-v2"
        )

        prepared.feedbackJson shouldNotContain "\"definition\""
        prepared.feedbackJson shouldNotContain "deduplicationKey"
        prepared.feedbackJson shouldContain "\"surveyType\":\"rating\""
        (prepared.deduplicationKeyHash?.isNotBlank()) shouldBe true
    }
})
