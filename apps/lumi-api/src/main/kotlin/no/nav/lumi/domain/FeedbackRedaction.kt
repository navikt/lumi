package no.nav.lumi.domain

import kotlinx.serialization.Serializable
import no.nav.lumi.config.exception.ApiErrorException
import java.security.MessageDigest

const val MANUAL_REDACTION_PLACEHOLDER = "[TEKST FJERNET]"

// Keep the marker definition aligned with TextProcessor's excluded redaction markers.
private val redactionMarkerRegex = Regex("\\[[A-ZÆØÅ][A-ZÆØÅ\\s-]+]")

@Serializable
data class TextRedactionRange(val start: Int, val end: Int)

@Serializable
data class RedactFeedbackInput(
    val fieldId: String,
    val expectedTextHash: String,
    val ranges: List<TextRedactionRange>,
) {
    fun validate() {
        if (fieldId.isBlank() || fieldId.length > 255 ||
            !expectedTextHash.matches(Regex("[0-9a-f]{64}")) || ranges.size !in 1..20
        ) invalidRedaction()
    }
}

internal fun textRedactionHash(text: String): String = MessageDigest.getInstance("SHA-256")
    .digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

/** Browser textarea selections and Kotlin substrings both use UTF-16 offsets. */
internal fun redactTextRanges(text: String, ranges: List<TextRedactionRange>): String {
    val sorted = ranges.sortedBy { it.start }
    val markers = redactionMarkerRegex.findAll(text).map { it.range }.toList()
    var previousEnd = 0
    for (range in sorted) {
        if (range.start < previousEnd || range.end <= range.start || range.end > text.length ||
            splitsSurrogatePair(text, range.start) || splitsSurrogatePair(text, range.end) ||
            markers.any { marker ->
                (range.start > marker.first && range.start <= marker.last) ||
                    (range.end > marker.first && range.end <= marker.last)
            }
        ) invalidRedaction()
        previousEnd = range.end
    }
    return buildString {
        var offset = 0
        for (range in sorted) {
            append(text, offset, range.start)
            append(MANUAL_REDACTION_PLACEHOLDER)
            offset = range.end
        }
        append(text, offset, text.length)
    }.also { if (it == text) invalidRedaction() }
}

private fun splitsSurrogatePair(text: String, offset: Int): Boolean =
    offset in 1 until text.length && text[offset - 1].isHighSurrogate() && text[offset].isLowSurrogate()

private fun invalidRedaction(): Nothing =
    throw ApiErrorException.BadRequestException("Velg en gyldig del av fritekstsvaret som skal maskeres.")
