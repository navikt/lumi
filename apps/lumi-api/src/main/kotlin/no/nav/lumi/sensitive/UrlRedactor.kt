package no.nav.lumi.sensitive

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder

data class UrlRedactionResult(
    val redactedUrl: String,
    val wasRedacted: Boolean
)

/**
 * Redacts PII from URLs by:
 * 1. Parsing query parameters and redacting each value individually
 * 2. Running full-string PII redaction on the non-query portion (path, etc.)
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

        // Split on '?' to separate base from query
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

        // Redact PII in path/base via full-string redaction
        val baseResult = sensitiveDataFilter.redact(baseUrl)
        val redactedBase = baseResult.redactedText
        if (baseResult.wasRedacted) wasRedacted = true

        // Redact each query parameter (both key and value)
        val redactedQuery = if (queryString != null) {
            val params = queryString.split("&").map { param ->
                val eqIdx = param.indexOf('=')
                if (eqIdx < 0) {
                    // Bare token without '=' — redact it as data
                    val decoded = try {
                        URLDecoder.decode(param, Charsets.UTF_8.name())
                    } catch (_: Exception) { param }
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
                    val decodedKey = try {
                        URLDecoder.decode(rawKey, Charsets.UTF_8.name())
                    } catch (_: Exception) { rawKey }
                    val keyResult = sensitiveDataFilter.redact(decodedKey)
                    val finalKey = if (keyResult.wasRedacted) {
                        wasRedacted = true
                        URLEncoder.encode(keyResult.redactedText, Charsets.UTF_8.name())
                    } else {
                        rawKey
                    }

                    // Redact value
                    val decodedValue = try {
                        URLDecoder.decode(rawValue, Charsets.UTF_8.name())
                    } catch (_: Exception) { rawValue }
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

        // Redact PII in fragment
        val redactedFragment = if (fragment != null) {
            val fragResult = sensitiveDataFilter.redact(fragment)
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
}
