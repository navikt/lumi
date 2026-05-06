package no.nav.lumi.sensitive

import kotlinx.serialization.json.*

/**
 * Recursively walks a JsonElement tree and redacts PII from:
 * - String primitive values
 * - Numeric primitive values (converted to string for PII matching)
 * - Object keys containing PII (replaced with [REDACTED_KEY_n])
 *
 * Booleans and nulls are left untouched.
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
                    val originalKeys = el.keys
                    val newEntries = mutableMapOf<String, JsonElement>()
                    for ((key, value) in el) {
                        val keyResult = sensitiveDataFilter.redact(key)
                        val finalKey = if (keyResult.wasRedacted) {
                            wasRedacted = true
                            keyCounter++
                            generateUniqueKey(newEntries, originalKeys, keyCounter)
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
                    // Skip booleans and null
                    if (el is JsonNull || el.booleanOrNull != null) {
                        el
                    } else {
                        val content = el.content
                        val result = sensitiveDataFilter.redact(content)
                        if (result.wasRedacted) {
                            wasRedacted = true
                            JsonPrimitive(result.redactedText)
                        } else {
                            el
                        }
                    }
                }
            }
        }

        val result = walk(element)
        return result to wasRedacted
    }
}
