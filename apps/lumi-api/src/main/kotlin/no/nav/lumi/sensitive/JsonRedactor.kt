package no.nav.lumi.sensitive

import kotlinx.serialization.json.*

/**
 * Recursively walks a JsonElement tree and redacts PII from:
 * - String primitive values
 * - Object keys containing PII (replaced with [REDACTED_KEY_n])
 *
 * Numbers, booleans, and nulls are left untouched.
 */
class JsonRedactor(
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT
) {
    /**
     * Redact PII from a JSON element recursively.
     * Returns the redacted element and whether any redaction occurred.
     */
    fun redactJsonElement(element: JsonElement): Pair<JsonElement, Boolean> {
        var wasRedacted = false
        var keyCounter = 0

        fun walk(el: JsonElement): JsonElement {
            return when (el) {
                is JsonObject -> {
                    val newEntries = mutableMapOf<String, JsonElement>()
                    for ((key, value) in el) {
                        // Check if key contains PII
                        val keyResult = sensitiveDataFilter.redact(key)
                        val finalKey = if (keyResult.wasRedacted) {
                            wasRedacted = true
                            keyCounter++
                            "[REDACTED_KEY_$keyCounter]"
                        } else {
                            key
                        }
                        newEntries[finalKey] = walk(value)
                    }
                    JsonObject(newEntries)
                }
                is JsonArray -> {
                    JsonArray(el.map { walk(it) })
                }
                is JsonPrimitive -> {
                    if (el.isString) {
                        val content = el.content
                        val result = sensitiveDataFilter.redact(content)
                        if (result.wasRedacted) {
                            wasRedacted = true
                            JsonPrimitive(result.redactedText)
                        } else {
                            el
                        }
                    } else {
                        el // numbers, booleans, nulls — leave as-is
                    }
                }
                is JsonNull -> el
            }
        }

        val result = walk(element)
        return result to wasRedacted
    }
}
