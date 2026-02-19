package no.nav.lumi.service

import kotlinx.serialization.json.*
import no.nav.lumi.domain.FeedbackDto
import no.nav.lumi.domain.FeedbackQuery
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.sensitive.SensitiveDataFilter
import org.slf4j.LoggerFactory

class FeedbackService(
    private val repository: FeedbackRepository = FeedbackRepository(),
    private val sensitiveDataFilter: SensitiveDataFilter = SensitiveDataFilter.DEFAULT
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

    private fun redactFeedbackJson(feedbackJson: String): String {
        return try {
            val jsonElement = json.parseToJsonElement(feedbackJson)
            val jsonObj = jsonElement.jsonObject.toMutableMap()
            var hasRedactions = false
            
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
                                    valueObj["text"] = JsonPrimitive(redacted.redactedText)
                                    answerObj["value"] = JsonObject(valueObj)
                                    log.info("Redacted sensitive data from answer fieldId=${answerObj["fieldId"]}: ${redacted.matchedPatterns}")
                                }
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
}
