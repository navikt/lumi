package no.nav.lumi.repository

import no.nav.lumi.domain.AnswerValue
import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.MetadataValueWithCount
import no.nav.lumi.domain.SpecializedSurveyFieldIds
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.VarCharColumnType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.*
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.time.Instant

data class SurveyOverview(
    val surveysByApp: Map<String, List<String>>,
    val firstSubmissionBySurvey: Map<String, String>,
    val lastSubmissionBySurvey: Map<String, String>,
    val submissionBoundsByApp: Map<String, Map<String, SurveySubmissionBounds>>,
)

data class SurveySubmissionBounds(
    val firstSubmissionAt: String,
    val lastSubmissionAt: String,
)

class FeedbackContextTagsRepository {
    /**
     * Surveys grouped by app and their first/latest submission timestamps.
     * Both views are derived from the same result set so bootstrap cannot
     * cache a survey list and recency metadata from different DB snapshots.
     */
    suspend fun findSurveyOverview(team: String): SurveyOverview {
        return dbQuery {
            val sql = """
                SELECT
                    app,
                    feedback_json::jsonb->>'surveyId' as survey_id,
                    MIN(opprettet) as first_submission_at,
                    MAX(opprettet) as last_submission_at
                FROM feedback
                WHERE team = ?
                  AND app IS NOT NULL
                  AND feedback_json::jsonb->>'surveyId' IS NOT NULL
                GROUP BY app, feedback_json::jsonb->>'surveyId'
                ORDER BY app, survey_id
            """.trimIndent()

            val surveysByApp = mutableMapOf<String, MutableList<String>>()
            val firstSubmissionInstants = mutableMapOf<String, Instant>()
            val lastSubmissionInstants = mutableMapOf<String, Instant>()
            val submissionBoundsByApp = mutableMapOf<String, MutableMap<String, SurveySubmissionBounds>>()
            val transaction = TransactionManager.current()
            transaction.exec(sql, listOf(VarCharColumnType() to team)) { rs ->
                while (rs.next()) {
                    val app = rs.getString("app") ?: continue
                    val surveyId = rs.getString("survey_id") ?: continue
                    val firstSubmissionAt = rs.getTimestamp("first_submission_at")?.toInstant() ?: continue
                    val lastSubmissionAt = rs.getTimestamp("last_submission_at")?.toInstant() ?: continue
                    surveysByApp.getOrPut(app) { mutableListOf() }.add(surveyId)
                    submissionBoundsByApp.getOrPut(app) { mutableMapOf() }[surveyId] = SurveySubmissionBounds(
                        firstSubmissionAt = firstSubmissionAt.toString(),
                        lastSubmissionAt = lastSubmissionAt.toString(),
                    )
                    firstSubmissionInstants.merge(surveyId, firstSubmissionAt) { current, candidate ->
                        minOf(current, candidate)
                    }
                    lastSubmissionInstants.merge(surveyId, lastSubmissionAt) { current, candidate ->
                        maxOf(current, candidate)
                    }
                }
            }
            SurveyOverview(
                surveysByApp = surveysByApp,
                firstSubmissionBySurvey = firstSubmissionInstants.mapValues { (_, instant) -> instant.toString() },
                lastSubmissionBySurvey = lastSubmissionInstants.mapValues { (_, instant) -> instant.toString() },
                submissionBoundsByApp = submissionBoundsByApp,
            )
        }
    }

    suspend fun findMetadataKeysForSurvey(surveyId: String, team: String): Map<String, Set<String>> {
        return dbQuery {
            val sql = """
                SELECT DISTINCT
                    key as metadata_key,
                    feedback_json::jsonb->'context'->'tags'->>key as metadata_value
                FROM feedback,
                     jsonb_object_keys(feedback_json::jsonb->'context'->'tags') as key
                WHERE team = ?
                  AND feedback_json::jsonb->>'surveyId' = ?
                  AND feedback_json::jsonb->'context'->'tags' IS NOT NULL
            """.trimIndent()

            val result = mutableMapOf<String, MutableSet<String>>()
            val transaction = TransactionManager.current()
            transaction.exec(sql, listOf(VarCharColumnType() to team, VarCharColumnType() to surveyId)) { rs ->
                while (rs.next()) {
                    val key = rs.getString("metadata_key") ?: continue
                    val value = rs.getString("metadata_value") ?: continue
                    result.getOrPut(key) { mutableSetOf() }.add(value)
                }
            }
            result
        }
    }

    suspend fun findContextTagsForSurvey(
        surveyId: String,
        team: String,
        task: String? = null,
        segments: List<Pair<String, String>> = emptyList(),
        fromDate: String? = null,
        toDate: String? = null,
        deviceType: String? = null,
        hasText: Boolean = false,
        lowRating: Boolean = false,
    ): Map<String, List<MetadataValueWithCount>> {
        if (task.isNullOrBlank()) {
            return dbQuery {
                // Build dynamic filter clauses
                val filterClauses = mutableListOf<String>()
                val filterArgs = mutableListOf<Pair<IColumnType<*>, Any?>>()

                // Base args: team and surveyId
                filterArgs.add(VarCharColumnType() to team)
                filterArgs.add(VarCharColumnType() to surveyId)

                // Segment filters
                for ((key, value) in segments) {
                    val safeKey = key.trim()
                    val safeValue = value.trim()
                    if (safeKey.isBlank() || safeValue.isBlank()) continue
                    filterClauses.add("AND feedback_json::jsonb->'context'->'tags'->>? = ?")
                    filterArgs.add(VarCharColumnType() to safeKey)
                    filterArgs.add(VarCharColumnType() to safeValue)
                }

                // Date range filter (Europe/Oslo)
                if (!fromDate.isNullOrBlank()) {
                    filterClauses.add("AND opprettet >= (? || ' 00:00:00 Europe/Oslo')::timestamptz")
                    filterArgs.add(VarCharColumnType() to fromDate)
                }
                if (!toDate.isNullOrBlank()) {
                    filterClauses.add("AND opprettet < ((? || ' 00:00:00 Europe/Oslo')::timestamptz + interval '1 day')")
                    filterArgs.add(VarCharColumnType() to toDate)
                }

                // Device type filter
                if (!deviceType.isNullOrBlank()) {
                    filterClauses.add("AND feedback_json::jsonb->'context'->>'deviceType' = ?")
                    filterArgs.add(VarCharColumnType() to deviceType)
                }

                // Has text filter
                if (hasText) {
                    filterClauses.add("AND jsonb_path_exists(feedback_json::jsonb, '\$.answers[*] ? (@.value.type == \"text\" && @.value.text != \"\")')")
                }

                // Low rating filter (1-2)
                if (lowRating) {
                    filterClauses.add("AND (jsonb_path_query_first(feedback_json::jsonb, '\$.answers[*] ? (@.value.type == \"rating\").value.rating')::text)::int <= 2")
                }

                val sql = buildString {
                    append(
                        """
                    SELECT
                        key as tag_key,
                        feedback_json::jsonb->'context'->'tags'->>key as tag_value,
                        COUNT(*) as tag_count
                    FROM feedback,
                         jsonb_object_keys(feedback_json::jsonb->'context'->'tags') as key
                    WHERE team = ?
                      AND feedback_json::jsonb->>'surveyId' = ?
                      AND feedback_json::jsonb->'context'->'tags' IS NOT NULL
                    """.trimIndent()
                    )

                    if (filterClauses.isNotEmpty()) {
                        append("\n")
                        append(filterClauses.joinToString("\n"))
                    }

                    append("\n")
                    append(
                        """
                    GROUP BY key, tag_value
                """.trimIndent()
                    )
                }

                val result = mutableMapOf<String, MutableList<MetadataValueWithCount>>()

                val transaction = TransactionManager.current()
                transaction.exec(sql, filterArgs) { rs ->
                    while (rs.next()) {
                        val key = rs.getString("tag_key") ?: continue
                        val value = rs.getString("tag_value") ?: continue
                        val count = rs.getInt("tag_count")
                        result.getOrPut(key) { mutableListOf() }
                            .add(MetadataValueWithCount(value = value, count = count))
                    }
                }

                // Keep stable order (desc by count, then value) for deterministic responses
                result.mapValues { (_, values) ->
                    values.sortedWith(compareByDescending<MetadataValueWithCount> { it.count }.thenBy { it.value })
                }
            }
        }

        val records = dbQuery {
            val dbQuery = FeedbackTable.selectAll()
            dbQuery.andWhere { FeedbackTable.team eq team }
            dbQuery.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId }
            dbQuery.map { it.toDbRecord() }
        }

        val enriched = records.map { record -> record to record.toDto() }
        val taskFiltered = enriched.filter { (record, feedback) ->
            if (!matchesContextTagFilters(record, feedback, segments, fromDate, toDate, deviceType, hasText, lowRating)) {
                return@filter false
            }

            // Segment filter (context.tags)
            if (segments.isNotEmpty()) {
                val tags = feedback.context?.tags
                if (tags == null) return@filter false

                val matchesSegments = segments.all { (key, value) ->
                    val safeKey = key.trim()
                    val safeValue = value.trim()
                    safeKey.isNotBlank() && safeValue.isNotBlank() && tags[safeKey] == safeValue
                }
                if (!matchesSegments) return@filter false
            }

            val taskAnswer = SpecializedSurveyFieldIds.findTask(feedback.surveyType, feedback.answers)
            if (taskAnswer != null && taskAnswer.fieldType == FieldType.SINGLE_CHOICE) {
                val selectedId = (taskAnswer.value as? AnswerValue.SingleChoice)?.selectedOptionId
                selectedId == task
            } else {
                false
            }
        }

        val counts = mutableMapOf<String, MutableMap<String, Int>>()
        for ((_, feedback) in taskFiltered) {
            val tags = feedback.context?.tags ?: continue
            for ((key, value) in tags) {
                if (key.isBlank() || value.isBlank()) continue
                val perKey = counts.getOrPut(key) { mutableMapOf() }
                perKey[value] = (perKey[value] ?: 0) + 1
            }
        }

        return counts.mapValues { (_, valueCounts) ->
            valueCounts.entries
                .map { (value, count) -> MetadataValueWithCount(value = value, count = count) }
                .sortedWith(compareByDescending<MetadataValueWithCount> { it.count }.thenBy { it.value })
        }
    }
}
