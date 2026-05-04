package no.nav.lumi.sensitive

import java.net.URLDecoder
import java.net.URLEncoder

data class UrlRedactionResult(
    val redactedUrl: String,
    val wasRedacted: Boolean
)

/**
 * Redacts PII from URLs by:
 * 1. Parsing query parameters and redacting each key+value individually
 * 2. Running full-string PII redaction on the path (URL-decoded first)
 * 3. Redacting PII in fragments (URL-decoded first)
 *
 * Assumes standard URL ordering (path?query#fragment).
 * Falls back to plain-text redaction for unparseable input.
 */
class UrlRedactor(
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT
) {

    fun redactUrl(url: String?): UrlRedactionResult {
        if (url.isNullOrEmpty()) {
            return UrlRedactionResult(redactedUrl = "", wasRedacted = false)
        }

        return try {
            redactParsedUrl(url)
        } catch (_: Exception) {
            // Fallback: treat as plain text
            val result = sensitiveDataFilter.redact(url)
            UrlRedactionResult(result.redactedText, result.wasRedacted)
        }
    }

    private fun redactParsedUrl(url: String): UrlRedactionResult {
        var wasRedacted = false

        // Split on '?' to separate base from query (standard ordering assumed)
        val questionIdx = url.indexOf('?')
        val fragmentIdx = url.indexOf('#', if (questionIdx >= 0) questionIdx else 0)

        val baseUrl: String
        val queryString: String?
        val fragment: String?

        if (questionIdx >= 0) {
            baseUrl = url.substring(0, questionIdx)
            val afterQuestion = if (fragmentIdx >= 0) {
                url.substring(questionIdx + 1, fragmentIdx)
            } else {
                url.substring(questionIdx + 1)
            }
            queryString = afterQuestion.ifEmpty { null }
            fragment = if (fragmentIdx >= 0) url.substring(fragmentIdx + 1) else null
        } else {
            baseUrl = if (fragmentIdx >= 0) url.substring(0, fragmentIdx) else url
            queryString = null
            fragment = if (fragmentIdx >= 0) url.substring(fragmentIdx + 1) else null
        }

        // Redact PII in path/base — decode first to catch percent-encoded PII
        val decodedBase = decodeUntilStable(baseUrl)
        val baseResult = sensitiveDataFilter.redact(decodedBase)
        val redactedBase = if (baseResult.wasRedacted) {
            wasRedacted = true
            baseResult.redactedText
        } else {
            baseUrl // preserve original encoding when no PII found
        }

        // Redact each query parameter (both key and value)
        val redactedQuery = if (queryString != null) {
            val params = queryString.split("&").map { param ->
                val eqIdx = param.indexOf('=')
                if (eqIdx < 0) {
                    // Bare token without '=' — redact it as data
                    val decoded = decodeUntilStable(param)
                    val redacted = sensitiveDataFilter.redact(decoded)
                    if (redacted.wasRedacted) {
                        wasRedacted = true
                        URLEncoder.encode(redacted.redactedText, Charsets.UTF_8.name())
                    } else {
                        param
                    }
                } else {
                    val rawKey = param.substring(0, eqIdx)
                    val rawValue = param.substring(eqIdx + 1)

                    // Redact key
                    val decodedKey = decodeUntilStable(rawKey)
                    val keyResult = sensitiveDataFilter.redact(decodedKey)
                    val finalKey = if (keyResult.wasRedacted) {
                        wasRedacted = true
                        URLEncoder.encode(keyResult.redactedText, Charsets.UTF_8.name())
                    } else {
                        rawKey
                    }

                    // Redact value
                    val decodedValue = decodeUntilStable(rawValue)
                    val valueResult = sensitiveDataFilter.redact(decodedValue)
                    val finalValue = if (valueResult.wasRedacted) {
                        wasRedacted = true
                        URLEncoder.encode(valueResult.redactedText, Charsets.UTF_8.name())
                    } else {
                        rawValue
                    }

                    "$finalKey=$finalValue"
                }
            }
            params.joinToString("&")
        } else null

        // Redact PII in fragment — decode first
        val redactedFragment = if (fragment != null) {
            val decodedFragment = decodeUntilStable(fragment)
            val fragResult = sensitiveDataFilter.redact(decodedFragment)
            if (fragResult.wasRedacted) {
                wasRedacted = true
                fragResult.redactedText
            } else {
                fragment
            }
        } else null

        val result = buildString {
            append(redactedBase)
            if (questionIdx >= 0) {
                append('?')
                if (redactedQuery != null) append(redactedQuery)
            }
            if (redactedFragment != null) {
                append('#')
                append(redactedFragment)
            }
        }

        return UrlRedactionResult(result, wasRedacted)
    }

    /**
     * Iteratively percent-decode until the string no longer changes.
     * Prevents double-encoding bypass (e.g. %2530%2531... → %30%31... → 01...).
     * Limited to 3 passes to avoid infinite loops on pathological input.
     *
     * Uses percent-only decoding: `+` is preserved as literal `+` (not treated as space).
     * This prevents multi-pass degradation where `%2B` → `+` → ` ` would break
     * email matching for plus-alias addresses like `ola+alias@nav.no`.
     */
    private fun decodeUntilStable(input: String): String {
        var current = input
        repeat(3) {
            val decoded = try {
                percentDecode(current)
            } catch (_: Exception) {
                return current
            }
            if (decoded == current) return current
            current = decoded
        }
        return current
    }

    /**
     * Decode only %xx sequences, preserving `+` as literal.
     * Unlike URLDecoder.decode(), this does NOT treat `+` as space.
     */
    private fun percentDecode(input: String): String {
        // Protect `+` from URLDecoder's form-encoding interpretation
        val preserved = input.replace("+", "%2B")
        return URLDecoder.decode(preserved, Charsets.UTF_8.name())
    }
}
