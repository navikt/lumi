package no.nav.lumi.routes

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.PhraseFilter
import no.nav.lumi.repository.MAX_CHOICE_VALUE_LENGTH
import no.nav.lumi.repository.MAX_FIELD_ID_LENGTH
import no.nav.lumi.repository.isSafeChoiceValue
import no.nav.lumi.repository.validateJsonPathFieldId
import no.nav.lumi.service.TextProcessor
import org.slf4j.LoggerFactory
import java.time.LocalDate

private const val MAX_PAGE_SIZE = 200
private const val MAX_QUERY_LENGTH = 200
private const val MAX_TAGS = 20
private const val MAX_TAG_LENGTH = 50
private const val MAX_SEGMENTS = 20
private const val MAX_SEGMENT_KEY_LENGTH = 50
private const val MAX_SEGMENT_VALUE_LENGTH = 100
private const val MAX_PHRASE_WORD_LENGTH = 30
private const val MAX_PHRASE_TOTAL_LENGTH = 80
private val validationLog = LoggerFactory.getLogger("QueryValidation")

internal data class Paging(
    val page: Int,
    val size: Int,
)

internal fun parsePaging(
    page: Int?,
    size: Int?,
    defaultSize: Int = 10,
): Paging {
    val safePage = page ?: 0
    if (safePage < 0) {
        throw ApiErrorException.BadRequestException("Invalid page: must be >= 0")
    }

    val safeSize = size ?: defaultSize
    if (safeSize !in 1..MAX_PAGE_SIZE) {
        throw ApiErrorException.BadRequestException("Invalid size: must be between 1 and $MAX_PAGE_SIZE")
    }

    return Paging(page = safePage, size = safeSize)
}

internal fun parseSearchQuery(rawQuery: String?): String? {
    val query = rawQuery?.trim()?.takeIf { it.isNotBlank() } ?: return null
    if (query.length > MAX_QUERY_LENGTH) {
        throw ApiErrorException.BadRequestException("Invalid query: max length is $MAX_QUERY_LENGTH")
    }
    return query
}

internal fun parseTags(rawTags: List<String>?): List<String> {
    val tags = rawTags
        ?.flatMap { it.split(",") }
        ?.map { it.trim() }
        ?.filter { it.isNotBlank() }
        ?: emptyList()

    if (tags.size > MAX_TAGS) {
        throw ApiErrorException.BadRequestException("Invalid tags: max count is $MAX_TAGS")
    }
    if (tags.any { it.length > MAX_TAG_LENGTH }) {
        throw ApiErrorException.BadRequestException("Invalid tags: max length per tag is $MAX_TAG_LENGTH")
    }

    return tags
}

internal fun parseSegments(rawSegments: List<String>?): List<Pair<String, String>> {
    if (rawSegments.isNullOrEmpty()) return emptyList()

    val parsed = mutableListOf<Pair<String, String>>()

    rawSegments
        .flatMap { it.split(",") }
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .forEach { segment ->
            val parts = segment.split(":", limit = 2)
            if (parts.size != 2) {
                throw ApiErrorException.BadRequestException("Invalid segment: expected format key:value")
            }

            val key = parts[0].trim()
            val value = parts[1].trim()
            if (key.isBlank() || value.isBlank()) {
                throw ApiErrorException.BadRequestException("Invalid segment: key and value must be non-blank")
            }
            if (key.length > MAX_SEGMENT_KEY_LENGTH) {
                throw ApiErrorException.BadRequestException(
                    "Invalid segment key: max length is $MAX_SEGMENT_KEY_LENGTH"
                )
            }
            if (value.length > MAX_SEGMENT_VALUE_LENGTH) {
                throw ApiErrorException.BadRequestException(
                    "Invalid segment value: max length is $MAX_SEGMENT_VALUE_LENGTH"
                )
            }

            parsed += key to value
        }

    if (parsed.size > MAX_SEGMENTS) {
        throw ApiErrorException.BadRequestException("Invalid segments: max count is $MAX_SEGMENTS")
    }

    return parsed
}

internal fun validateDateRange(fromDate: String?, toDate: String?) {
    val from = parseDateOrThrow(name = "fromDate", value = fromDate)
    val to = parseDateOrThrow(name = "toDate", value = toDate)

    if (from != null && to != null && from.isAfter(to)) {
        throw ApiErrorException.BadRequestException("Invalid date range: fromDate must be <= toDate")
    }
}

internal fun parseDateOrThrow(name: String, value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null

    return try {
        LocalDate.parse(value)
    } catch (_: Exception) {
        throw ApiErrorException.BadRequestException("Invalid $name: expected YYYY-MM-DD")
    }
}

private const val MAX_FIELD_FILTERS = 20

/** Validate fieldId: alphanumeric, hyphens, underscores only — same rules as [validateJsonPathFieldId]. */
private fun requireValidFieldId(fieldId: String, filterType: String): String {
    if (fieldId.length > MAX_FIELD_ID_LENGTH) {
        throw ApiErrorException.BadRequestException(
            "Invalid $filterType filter: fieldId exceeds max length $MAX_FIELD_ID_LENGTH"
        )
    }
    if (!fieldId.all { it.isLetterOrDigit() || it == '-' || it == '_' }) {
        throw ApiErrorException.BadRequestException(
            "Invalid $filterType filter: fieldId contains illegal characters"
        )
    }
    return fieldId
}

/**
 * Parse repeated "fieldId:optionId" choice filter params into pairs.
 * Also merges in legacy single-value params for backward compat.
 * Throws 400 on malformed input or exceeding limits.
 */
internal fun parseChoiceFilters(
    choice: List<String>?,
    legacyFieldId: String?,
    legacyValue: String?,
): List<Pair<String, String>> {
    val filters = mutableListOf<Pair<String, String>>()

    choice?.forEach { filter ->
        val colonIndex = filter.indexOf(':')
        if (colonIndex <= 0) {
            throw ApiErrorException.BadRequestException("Invalid choice filter: expected format fieldId:value")
        }
        val fieldId = filter.substring(0, colonIndex).trim()
        val value = filter.substring(colonIndex + 1).trim()
        if (fieldId.isBlank() || value.isBlank()) {
            throw ApiErrorException.BadRequestException("Invalid choice filter: fieldId and value must be non-blank")
        }
        if (value.length > MAX_CHOICE_VALUE_LENGTH) {
            throw ApiErrorException.BadRequestException(
                "Invalid choice filter: value exceeds max length $MAX_CHOICE_VALUE_LENGTH"
            )
        }
        if (!isSafeChoiceValue(value)) {
            throw ApiErrorException.BadRequestException(
                "Invalid choice filter: value contains illegal characters"
            )
        }
        requireValidFieldId(fieldId, "choice")
        filters.add(fieldId to value)
    }

    if (!legacyFieldId.isNullOrBlank() && !legacyValue.isNullOrBlank()) {
        val trimmedLegacyValue = legacyValue.trim()
        requireValidFieldId(legacyFieldId.trim(), "choice")
        if (!isSafeChoiceValue(trimmedLegacyValue)) {
            throw ApiErrorException.BadRequestException(
                "Invalid choice filter: value contains illegal characters"
            )
        }
        filters.add(legacyFieldId.trim() to trimmedLegacyValue)
    }

    if (filters.size > MAX_FIELD_FILTERS) {
        throw ApiErrorException.BadRequestException(
            "Too many choice filters: max is $MAX_FIELD_FILTERS"
        )
    }

    return filters
}

/**
 * Parse repeated "fieldId:ratingValue" rating filter params into pairs.
 * Also merges in legacy single-value params for backward compat.
 * Throws 400 on malformed input or exceeding limits.
 */
internal fun parseRatingFilters(
    rating: List<String>?,
    legacyFieldId: String?,
    legacyValue: Int?,
): List<Pair<String, Int>> {
    val filters = mutableListOf<Pair<String, Int>>()

    rating?.forEach { filter ->
        val colonIndex = filter.indexOf(':')
        if (colonIndex <= 0) {
            throw ApiErrorException.BadRequestException("Invalid rating filter: expected format fieldId:value")
        }
        val fieldId = filter.substring(0, colonIndex).trim()
        val value = filter.substring(colonIndex + 1).trim().toIntOrNull()
            ?: throw ApiErrorException.BadRequestException("Invalid rating filter: value must be an integer")
        if (fieldId.isBlank()) {
            throw ApiErrorException.BadRequestException("Invalid rating filter: fieldId must be non-blank")
        }
        requireValidFieldId(fieldId, "rating")
        filters.add(fieldId to value)
    }

    if (!legacyFieldId.isNullOrBlank() && legacyValue != null) {
        requireValidFieldId(legacyFieldId.trim(), "rating")
        filters.add(legacyFieldId.trim() to legacyValue)
    }

    if (filters.size > MAX_FIELD_FILTERS) {
        throw ApiErrorException.BadRequestException(
            "Too many rating filters: max is $MAX_FIELD_FILTERS"
        )
    }

    return filters
}

internal fun parsePhraseFilter(raw: List<String>?): PhraseFilter? {
    if (raw.isNullOrEmpty()) return null
    if (raw.size > 1) {
        throw ApiErrorException.BadRequestException("Only a single phrase filter is supported")
    }

    val filter = raw.single()
    val parts = filter.split(":", limit = 2)
    if (parts.size != 2) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }

    val fieldId = validateJsonPathFieldId(parts[0], "phraseFieldId", validationLog)
        ?: throw ApiErrorException.BadRequestException("Invalid phrase format")
    if (parts[1].contains(':')) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }
    if (!parts[1].matches(Regex("^[\\p{L}\\p{N}\\s]+$"))) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }

    val normalizedWords = TextProcessor.extractWords(parts[1])
    if (normalizedWords.size != 2) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }
    if (normalizedWords.any { it.length > MAX_PHRASE_WORD_LENGTH }) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }

    val normalizedSurface = normalizedWords.joinToString(" ")
    if (normalizedSurface.length > MAX_PHRASE_TOTAL_LENGTH) {
        throw ApiErrorException.BadRequestException("Invalid phrase format")
    }

    return PhraseFilter(fieldId = fieldId, surface = normalizedSurface)
}
