package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.config.exception.ApiErrorException

class FeedbackRedactionTest : FunSpec({
    test("only selected spans are replaced, including repeated names and line breaks") {
        val text = "Ola fikk hjelp.\nMvh Ola"
        redactTextRanges(text, listOf(TextRedactionRange(20, 23))) shouldBe
            "Ola fikk hjelp.\nMvh [TEKST FJERNET]"
    }

    test("multiple spans use the original offsets") {
        redactTextRanges("Ola og Kari", listOf(TextRedactionRange(7, 11), TextRedactionRange(0, 3))) shouldBe
            "[TEKST FJERNET] og [TEKST FJERNET]"
    }

    test("UTF-16 offsets preserve emoji outside the selection") {
        redactTextRanges("🙂 Ola", listOf(TextRedactionRange(3, 6))) shouldBe "🙂 [TEKST FJERNET]"
    }

    test("invalid, overlapping and split surrogate ranges are rejected") {
        listOf(
            listOf(TextRedactionRange(-1, 2)),
            listOf(TextRedactionRange(2, 2)),
            listOf(TextRedactionRange(0, 100)),
            listOf(TextRedactionRange(0, 4), TextRedactionRange(3, 5)),
            listOf(TextRedactionRange(1, 2)),
            listOf(TextRedactionRange(0, 1)),
        ).forEach { ranges ->
            shouldThrow<ApiErrorException.BadRequestException> { redactTextRanges("🙂 Ola", ranges) }
        }
    }

    test("the request must have a field, a text fingerprint and bounded selections") {
        val valid = RedactFeedbackInput("feedback", textRedactionHash("hello"), listOf(TextRedactionRange(0, 2)))
        valid.validate()
        listOf(
            valid.copy(fieldId = ""),
            valid.copy(expectedTextHash = "hello"),
            valid.copy(ranges = emptyList()),
            valid.copy(ranges = List(21) { TextRedactionRange(0, 2) }),
        ).forEach { input -> shouldThrow<ApiErrorException.BadRequestException> { input.validate() } }
    }
})
