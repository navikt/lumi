package no.nav.lumi.repository

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import no.nav.lumi.CapturedLogs
import no.nav.lumi.domain.FeedbackDbRecord
import java.time.OffsetDateTime

class StoredFeedbackJsonTest : FunSpec({
    // Broken JSON whose parser message would quote the answer text.
    val brokenJson = """{"surveyId":"s","answers":[{"value":{"text":"Z123456 Kari Nordmann"""

    fun CapturedLogs.shouldNotQuoteTheAnswer() {
        messages.shouldNotBeEmpty()
        (messages + throwableTexts).forEach { text ->
            text shouldNotContain "Z123456"
            text shouldNotContain "Kari Nordmann"
        }
    }

    test("an unreadable answer is shown as empty without logging its text") {
        val record = FeedbackDbRecord(
            id = "feedback-1",
            opprettet = OffsetDateTime.parse("2026-10-01T12:00:00Z"),
            feedbackJson = brokenJson,
            team = "team-test",
            app = "app-test",
        )

        CapturedLogs("Extensions").use { logs ->
            val dto = record.toDto()

            dto.surveyId shouldBe "unknown"
            dto.answers shouldBe emptyList()
            logs.shouldNotQuoteTheAnswer()
        }
    }

    test("a parse failure in the phrase filter logs only the error type") {
        CapturedLogs("Extensions").use { logs ->
            parseStoredFeedbackJson(brokenJson, "feedback-2", purpose = "phrase filter") shouldBe null

            logs.shouldNotQuoteTheAnswer()
            logs.messages.single() shouldBe
                "Failed to parse feedback JSON for phrase filter id=feedback-2 errorType=JsonDecodingException"
        }
    }
})
