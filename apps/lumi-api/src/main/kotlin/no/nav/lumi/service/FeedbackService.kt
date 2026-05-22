package no.nav.lumi.service

import kotlinx.serialization.json.*
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.domain.SaveResult
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.sensitive.HtmlSanitizer
import no.nav.lumi.sensitive.JsonRedactor
import no.nav.lumi.sensitive.SensitiveDataFilter
import no.nav.lumi.sensitive.UrlRedactor
import no.nav.lumi.sensitive.generateUniqueKey
import no.nav.lumi.validation.DeduplicationKeyValidator
import org.slf4j.LoggerFactory

class FeedbackService(
    private val repository: FeedbackRepository = FeedbackRepository(),
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT,
    private val htmlSanitizer: HtmlSanitizer = HtmlSanitizer.DEFAULT,
    private val urlRedactor: UrlRedactor = UrlRedactor(sensitiveDataFilter),
    private val jsonRedactor: JsonRedactor = JsonRedactor(sensitiveDataFilter)
) {
    private val log = LoggerFactory.getLogger(FeedbackService::class.java)
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun findPaginated(query: FeedbackQuery) = repository.findPaginated(query)

    suspend fun findById(id: String, team: String) = repository.findById(id, team)

    suspend fun findDuplicateSubmissionId(team: String, surveyId: String?, deduplicationKey: String?): String? {
        if (deduplicationKey == null) {
            return null
        }
        if (surveyId == null) {
            throw ApiErrorException.BadRequestException("Invalid payload: deduplicationKey requires surveyId")
        }

        DeduplicationKeyValidator.validate(deduplicationKey)
        val deduplicationKeyHash = computeDeduplicationKeyHash(team, surveyId, deduplicationKey)
        return repository.findIdByDeduplicationKeyHash(team, surveyId, deduplicationKeyHash)
    }

    suspend fun findAllTags(team: String) = repository.findAllTags(team)

    suspend fun findDistinctApps(team: String) = repository.findDistinctApps(team)

    suspend fun save(
        feedbackJson: String,
        team: String,
        app: String,
        surveyId: String? = null,
        definitionHash: String? = null
    ): SaveResult {
        val prepared = prepareForSave(feedbackJson, team, surveyId)

        return repository.save(
            feedbackJson = prepared.feedbackJson,
            team = team,
            app = app,
            surveyId = surveyId,
            definitionHash = definitionHash,
            deduplicationKeyHash = prepared.deduplicationKeyHash
        )
    }

    internal fun prepareForSave(feedbackJson: String, team: String, surveyId: String?): PreparedFeedbackSave {
        val prepared = redactFeedbackJson(feedbackJson)
        return PreparedFeedbackSave(
            feedbackJson = prepared.feedbackJson,
            deduplicationKeyHash = deduplicationKeyHash(team, surveyId, prepared.deduplicationKey)
        )
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
     * 5. Root deduplicationKey — removed before persistence; only the scoped hash is retained
     *    in the dedicated database column when deduplication is requested.
     * 6. Text answers — PII redacted, but HTML preserved (React escapes at render)
     * 7. Metadata fields (question.label, options[].label etc.) — NOT sanitized
     *    These are survey-defined by the team admin, not user-authored free text.
     *    SubmissionValidator enforces length limits on all metadata fields.
     *    React escapes all output, so stored HTML is inert in the dashboard.
     */
    private fun redactFeedbackJson(feedbackJson: String): PreparedFeedbackJson {
        return try {
            val jsonElement = json.parseToJsonElement(feedbackJson)
            val jsonObj = jsonElement.jsonObject.toMutableMap()
            var hasRedactions = false
            val deduplicationKey = extractDeduplicationKey(jsonObj)
            jsonObj.remove("deduplicationKey")

            val context = jsonObj["context"] as? JsonObject
            if (context != null) {
                val (sanitizedContext, contextHadRedactions) = sanitizeAndRedactContext(context)
                jsonObj["context"] = sanitizedContext
                if (contextHadRedactions) hasRedactions = true
            }
            
            val answers = jsonObj["answers"] as? JsonArray
            if (answers != null) {
                val redactedAnswers = answers.map { answerEl ->
                    val answerObj = answerEl.jsonObject.toMutableMap()
                    val valueObj = answerObj["value"]?.jsonObject?.toMutableMap()

                    if (valueObj != null) {
                        val type = valueObj["type"]?.jsonPrimitive?.contentOrNull
                        if (type == "text") {
                            val originalText = valueObj["text"]?.jsonPrimitive?.contentOrNull ?: ""
                            val redacted = sensitiveDataFilter.redact(originalText)
                            if (redacted.wasRedacted) {
                                hasRedactions = true
                                log.info("Redacted sensitive data from text answer: {}", redacted.matchedPatterns)
                            }
                            valueObj["text"] = JsonPrimitive(redacted.redactedText)
                            answerObj["value"] = JsonObject(valueObj)
                        }
                    }
                    JsonObject(answerObj)
                }
                jsonObj["answers"] = JsonArray(redactedAnswers)
            }

            // Persist a robust signal for redaction. Always set by backend based on actual redaction.
            jsonObj["sensitiveDataRedacted"] = JsonPrimitive(hasRedactions)

            PreparedFeedbackJson(
                feedbackJson = json.encodeToString(JsonObject.serializer(), JsonObject(jsonObj)),
                deduplicationKey = deduplicationKey
            )
        } catch (e: ApiErrorException) {
            throw e
        } catch (e: Exception) {
            // Do not log or propagate the throwable here. kotlinx.serialization parse exceptions can embed
            // raw JSON input (including deduplicationKey), and upstream exception logging must never leak it.
            if (feedbackJson.contains("\"deduplicationKey\"")) {
                log.error(
                    "Failed to redact feedback JSON with deduplication key, rejecting submission. errorType={}",
                    e::class.simpleName
                )
            } else {
                log.error(
                    "Failed to redact feedback JSON, rejecting submission to avoid storing unredacted data. errorType={}",
                    e::class.simpleName
                )
            }
            throw ApiErrorException.InternalServerErrorException("Failed to redact feedback JSON")
        }
    }

    private fun extractDeduplicationKey(jsonObj: MutableMap<String, JsonElement>): String? {
        val rawElement = jsonObj["deduplicationKey"] ?: return null
        if (rawElement is JsonNull) {
            return null
        }
        val primitive = rawElement as? JsonPrimitive
            ?: throw ApiErrorException.BadRequestException(
                DeduplicationKeyValidator.ERROR_MESSAGE
            )

        if (!primitive.isString) {
            throw ApiErrorException.BadRequestException(
                DeduplicationKeyValidator.ERROR_MESSAGE
            )
        }

        return primitive.contentOrNull?.also(DeduplicationKeyValidator::validate)
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

        // HTML-strip + percent-decode + PII-redact pathname
        sanitizeStringField(sanitized, "pathname")
        val pathValue = sanitized["pathname"]?.jsonPrimitive?.contentOrNull
        if (pathValue != null) {
            val decoded = UrlRedactor.decodePercentEncoding(pathValue)
            val pathResult = sensitiveDataFilter.redact(decoded)
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

        // PII-redact debug recursively (handles JsonObject, JsonArray, strings, and numbers)
        val debug = sanitized["debug"]
        if (debug != null && debug !is JsonNull) {
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
        val originalKeys = tags.keys
        val result = mutableMapOf<String, JsonElement>()

        for ((key, value) in tags) {
            // HTML-strip + PII-redact key
            val strippedKey = htmlSanitizer.stripTags(key)
            val keyResult = sensitiveDataFilter.redact(strippedKey)
            val finalKey = if (keyResult.wasRedacted || strippedKey.isBlank()) {
                wasRedacted = true
                keyCounter++
                generateUniqueKey(result, originalKeys, keyCounter)
            } else if (result.containsKey(strippedKey)) {
                // HTML-stripping caused collision — generate unique key to avoid data loss
                keyCounter++
                generateUniqueKey(result, originalKeys, keyCounter)
            } else {
                strippedKey
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

    private data class PreparedFeedbackJson(
        val feedbackJson: String,
        val deduplicationKey: String?
    )

    internal data class PreparedFeedbackSave(
        val feedbackJson: String,
        val deduplicationKeyHash: String?
    )

    private fun deduplicationKeyHash(team: String, surveyId: String?, deduplicationKey: String?): String? {
        if (deduplicationKey == null) {
            return null
        }
        if (surveyId == null) {
            throw ApiErrorException.BadRequestException("Invalid payload: deduplicationKey requires surveyId")
        }

        return computeDeduplicationKeyHash(team, surveyId, deduplicationKey)
    }
}
