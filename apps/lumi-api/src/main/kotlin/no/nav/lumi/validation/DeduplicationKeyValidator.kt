package no.nav.lumi.validation

import no.nav.lumi.config.exception.ApiErrorException

object DeduplicationKeyValidator {
    private const val MIN_DEDUPLICATION_KEY_LENGTH = 16
    private const val MAX_DEDUPLICATION_KEY_LENGTH = 128
    private val DEDUPLICATION_KEY_PATTERN = Regex("^[A-Za-z0-9._:-]+$")
    internal const val ERROR_MESSAGE =
        "Invalid payload: deduplicationKey must be 16-128 characters and contain only letters, digits, '.', '_', ':', or '-'"

    fun validate(deduplicationKey: String?) {
        if (deduplicationKey == null) return
        if (
            deduplicationKey.length !in MIN_DEDUPLICATION_KEY_LENGTH..MAX_DEDUPLICATION_KEY_LENGTH ||
            !DEDUPLICATION_KEY_PATTERN.matches(deduplicationKey)
        ) {
            throw ApiErrorException.BadRequestException(ERROR_MESSAGE)
        }
    }
}
