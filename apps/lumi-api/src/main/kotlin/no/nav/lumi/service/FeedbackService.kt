package no.nav.lumi.service

import kotlinx.serialization.json.*
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.sensitive.HtmlSanitizer
import no.nav.lumi.sensitive.JsonRedactor
import no.nav.lumi.sensitive.SensitiveDataFilter
import no.nav.lumi.sensitive.UrlRedactor
import org.slf4j.LoggerFactory

class FeedbackService(
    private val repository: FeedbackRepository = FeedbackRepository(),
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT,
    private val htmlSanitizer: HtmlSanitizer = HtmlSanitizer.DEFAULT,
    private val urlRedactor: UrlRedactor = UrlRedactor(),
    private val jsonRedactor: JsonRedactor = JsonRedactor()
) {
    private val log = LoggerFactory.getLogger(FeedbackService::class.java)
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findPaginated(query: FeedbackQuery) = repository.findPaginated(query)

    suspend fun findById(id: String, team: String) = repository.findById(id, team)

    suspend fun findAllTags(team: String) = repository.findAllTags(team)

    suspend fun findDistinctApps(team: String) = repository.findDistinctApps(team)

    suspend fun save(feedbackJson: String, team: String, app: String): String {
        val sanitizedJson = redactFeedbackJson(feedbackJson)
        return repository.save(sanitizedJson, team, app)
    }

    suspend fun addTag(id: String, team: String, tag: String) = repository.addTag(id, team, tag)

    suspend fun removeTag(id: String, team: String, tag: String) = repository.removeTag(id, team, tag)

    /**
     * Permanently delete a feedback item from the database.
     */
    suspend fun delete(id: String, team: String): Boolean {
        return repository.delete(id, team)
    }

    /**
     * Permanently delete all feedback for a surveyId in the given team.
     * Returns number of deleted rows.
     */
    suspend fun deleteSurvey(surveyId: String, team: String): Int {
        return repository.deleteSurvey(surveyId, team)
    }

    /**
     * Permanently delete all markers and feedback for a surveyId in the given team.
     * Returns number of deleted feedback rows.
     */
    suspend fun deleteSurveyWithMarkers(surveyId: String, team: String): Int {
        return repository.deleteSurveyWithMarkers(surveyId, team)
    }

    /**
     * Sanitize and redact feedback JSON before persistence.
     *
     * Security strategy:
     * 1. Context fields (url, pathname, userAgent, tags) — HTML tags stripped (defense-in-depth)
     * 2. Context URL — PII redacted per query-param + full-string fallback for path
     * 3. Context tags — PII redacted in both keys and values
     * 4. Context debug — recursive PII redaction of all string values and keys
     * 5. Text answers — PII redacted, but HTML preserved (React escapes at render)
     * 6. Metadata fields (question.label, options[].label etc.) — NOT sanitized
     *    These are survey-defined by the team admin, not user-authored free text.
     *    SubmissionValidator enforces length limits on all metadata fields.
     *    React escapes all output, so stored HTML is inert in the dashboard.
     */
    private fun redactFeedbackJson(feedbackJson: String): String {
        return try {
            val jsonElement = json.parseToJsonElement(feedbackJson)
            val jsonObj = jsonElement.jsonObject.toMutableMap()
            var hasRedactions = false

            val context = jsonObj["context"] as? JsonObject
            if (context != null) {
                val (sanitizedContext, contextHadRedactions) = sanitizeAndRedactContext(context)
                jsonObj["context"] = sanitizedContext
                if (contextHadRedactions) hasRedactions = true
            }
            
            val answers = jsonObj["answers"] as? JsonArray
            if (answers != null) {
                val redactedAnswers = answers.map { answerEl ->
                    try {
                        val answerObj = answerEl.jsonObject.toMutableMap()
                        val valueObj = answerObj["value"]?.jsonObject?.toMutableMap()
                        
                        if (valueObj != null) {
                            val type = valueObj["type"]?.jsonPrimitive?.contentOrNull
                            if (type == "text") {
                                val originalText = valueObj["text"]?.jsonPrimitive?.contentOrNull ?: ""
                                val redacted = sensitiveDataFilter.redact(originalText)
                                if (redacted.wasRedacted) {
                                    hasRedactions = true
                                    log.info("Redacted sensitive data from answer fieldId=${answerObj["fieldId"]}: ${redacted.matchedPatterns}")
                                }
                                valueObj["text"] = JsonPrimitive(redacted.redactedText)
                                answerObj["value"] = JsonObject(valueObj)
                            }
                        }
                        JsonObject(answerObj)
                    } catch (e: Exception) {
                        log.warn("Failed to process answer for redaction", e)
                        answerEl
                    }
                }
                jsonObj["answers"] = JsonArray(redactedAnswers)
            }

            // Persist a robust signal for redaction. Always set by backend based on actual redaction.
            jsonObj["sensitiveDataRedacted"] = JsonPrimitive(hasRedactions)
            
            json.encodeToString(JsonObject.serializer(), JsonObject(jsonObj))
        } catch (e: Exception) {
            log.warn("Failed to redact feedback JSON, returning original", e)
            feedbackJson
        }
    }

    /**
     * Sanitize context fields (HTML strip) AND redact PII from URL, tags, and debug.
     * Returns the sanitized context and whether any PII was redacted.
     */
    private fun sanitizeAndRedactContext(context: JsonObject): Pair<JsonObject, Boolean> {
        val sanitized = context.toMutableMap()
        var wasRedacted = false

        // HTML-strip + PII-redact URL
        sanitizeStringField(sanitized, "url")
        val urlValue = sanitized["url"]?.jsonPrimitive?.contentOrNull
        if (urlValue != null) {
            val urlResult = urlRedactor.redactUrl(urlValue)
            if (urlResult.wasRedacted) {
                wasRedacted = true
                sanitized["url"] = JsonPrimitive(urlResult.redactedUrl)
            }
        }

        // HTML-strip + PII-redact pathname
        sanitizeStringField(sanitized, "pathname")
        val pathValue = sanitized["pathname"]?.jsonPrimitive?.contentOrNull
        if (pathValue != null) {
            val pathResult = sensitiveDataFilter.redact(pathValue)
            if (pathResult.wasRedacted) {
                wasRedacted = true
                sanitized["pathname"] = JsonPrimitive(pathResult.redactedText)
            }
        }

        sanitizeStringField(sanitized, "userAgent")

        // PII-redact tags (keys and values)
        val tags = sanitized["tags"] as? JsonObject
        if (tags != null) {
            val (redactedTags, tagsRedacted) = redactTags(tags)
            sanitized["tags"] = redactedTags
            if (tagsRedacted) wasRedacted = true
        }

        // PII-redact debug recursively (handles both JsonObject and JsonArray)
        val debug = sanitized["debug"]
        if (debug != null && (debug is JsonObject || debug is JsonArray)) {
            val (redactedDebug, debugRedacted) = jsonRedactor.redactJsonElement(debug)
            sanitized["debug"] = redactedDebug
            if (debugRedacted) wasRedacted = true
        }

        return JsonObject(sanitized) to wasRedacted
    }

    /**
     * Redact PII from tag keys and values. Also strips HTML from values.
     */
    private fun redactTags(tags: JsonObject): Pair<JsonObject, Boolean> {
        var wasRedacted = false
        var keyCounter = 0
        val result = mutableMapOf<String, JsonElement>()

        for ((key, value) in tags) {
            // Redact PII in key
            val keyResult = sensitiveDataFilter.redact(key)
            val finalKey = if (keyResult.wasRedacted) {
                wasRedacted = true
                keyCounter++
                "[REDACTED_KEY_$keyCounter]"
            } else {
                key
            }

            // Redact PII in value + HTML strip
            val content = (value as? JsonPrimitive)?.contentOrNull
            val finalValue = if (content != null) {
                val stripped = htmlSanitizer.stripTags(content)
                val redacted = sensitiveDataFilter.redact(stripped)
                if (redacted.wasRedacted) wasRedacted = true
                JsonPrimitive(redacted.redactedText)
            } else {
                value
            }

            result[finalKey] = finalValue
        }

        return JsonObject(result) to wasRedacted
    }

    private fun sanitizeStringField(container: MutableMap<String, JsonElement>, fieldName: String) {
        val rawValue = container[fieldName]?.jsonPrimitive?.contentOrNull ?: return
        container[fieldName] = JsonPrimitive(htmlSanitizer.stripTags(rawValue))
    }
}
