package no.nav.lumi.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.service.TextProcessor

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

    test("selections cannot split existing redaction markers") {
        listOf("[E-POST FJERNET]", "[FØDSELSNUMMER FJERNET]", "[HEMMELIG ADRESSE]", "[TEKST FJERNET]").forEach { marker ->
            val text = "Bra $marker skjema"
            val start = text.indexOf(marker)
            val end = start + marker.length
            listOf(
                TextRedactionRange(start + 1, end - 1),
                TextRedactionRange(end - 8, end - 1),
                TextRedactionRange(0, end - 1),
                TextRedactionRange(start + 1, text.length),
                TextRedactionRange(start, start + 1),
                TextRedactionRange(end - 1, end),
            ).forEach { range ->
                shouldThrow<ApiErrorException.BadRequestException> { redactTextRanges(text, listOf(range)) }
            }
        }
    }

    test("whole markers can be replaced without leaking marker words into analysis") {
        val text = "Bra [E-POST FJERNET] skjema"
        val start = text.indexOf('[')
        val end = text.indexOf(']') + 1
        val redacted = redactTextRanges(text, listOf(TextRedactionRange(start, end)))
        redacted shouldBe "Bra [TEKST FJERNET] skjema"
        TextProcessor.tokenize(redacted) shouldBe listOf("bra", "skjema")
        redactTextRanges(text, listOf(TextRedactionRange(0, end))) shouldBe "[TEKST FJERNET] skjema"
    }

    test("normal text and emoji around intact markers keep their original offsets") {
        val text = "🙂 Ola\r\n[E-POST FJERNET]\r\nMvh Kari"
        redactTextRanges(text, listOf(TextRedactionRange(3, 6), TextRedactionRange(text.indexOf("Kari"), text.length))) shouldBe
            "🙂 [TEKST FJERNET]\r\n[E-POST FJERNET]\r\nMvh [TEKST FJERNET]"
        redactTextRanges("[vanlig tekst] Ola", listOf(TextRedactionRange(1, 7))) shouldBe
            "[[TEKST FJERNET] tekst] Ola"
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
