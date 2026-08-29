package no.nav.lumi.repository

import no.nav.lumi.domain.FieldTrend
import no.nav.lumi.domain.FieldTrendGranularity
import no.nav.lumi.domain.FieldTrendPoint
import no.nav.lumi.domain.StatsQuery
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.Timestamp
import java.time.LocalDate
import java.time.ZoneId

/**
 * Computes one structured field's time series entirely in PostgreSQL.
 *
 * Only aggregate rows cross the JDBC boundary. The query deliberately reuses
 * the dashboard's team, survey, date, segment and answer-filter semantics.
 */
class FieldTrendRepository {
    suspend fun getFieldTrend(
        query: StatsQuery,
        fieldId: String,
        granularity: FieldTrendGranularity,
    ): FieldTrend = dbQuery {
        val sql = FieldTrendSql(query, fieldId, granularity)
        val connection = TransactionManager.current().connection.connection as Connection
        val points = linkedMapOf<String, MutableFieldTrendPoint>()

        connection.prepareStatement(sql.statement).use { statement ->
            sql.bind(statement)
            statement.fetchSize = 64
            statement.executeQuery().use { result ->
                while (result.next()) {
                    val periodStart = result.getObject("period_start", LocalDate::class.java).toString()
                    val responseCount = result.getInt("response_count")
                    val point = points.getOrPut(periodStart) {
                        MutableFieldTrendPoint(
                            responseCount = responseCount,
                            average = result.getBigDecimal("rating_average")?.toDouble(),
                        )
                    }

                    result.getString("option_id")?.takeIf { it.isNotBlank() }?.let { optionId ->
                        point.distribution[optionId] = result.getInt("option_count")
                    }
                }
            }
        }

        FieldTrend(
            fieldId = fieldId,
            granularity = granularity,
            points = points.map { (periodStart, point) ->
                val masked = point.responseCount < FeedbackStatsRepository.MIN_AGGREGATION_THRESHOLD
                FieldTrendPoint(
                    periodStart = periodStart,
                    responseCount = point.responseCount.takeUnless { masked },
                    average = point.average.takeUnless { masked },
                    distribution = point.distribution.takeUnless { masked }.orEmpty(),
                    masked = masked,
                )
            },
        )
    }
}

private data class MutableFieldTrendPoint(
    val responseCount: Int,
    val average: Double?,
    val distribution: MutableMap<String, Int> = linkedMapOf(),
)

private class FieldTrendSql(
    query: StatsQuery,
    fieldId: String,
    granularity: FieldTrendGranularity,
) {
    private val parameters = mutableListOf<Any>()
    val statement: String

    init {
        val conditions = mutableListOf("f.team = ?")
        parameters += query.team

        if (!query.includeArchived) {
            conditions += """
                NOT EXISTS (
                    SELECT 1
                    FROM survey_metadata sm
                    WHERE sm.team = f.team
                      AND sm.survey_id = f.feedback_json->>'surveyId'
                      AND sm.archived_at IS NOT NULL
                )
            """.trimIndent()
        }

        query.app?.let {
            conditions += "f.app = ?"
            parameters += it
        }
        query.surveyId?.let {
            conditions += "f.feedback_json->>'surveyId' = ?"
            parameters += it
        }
        query.fromDate?.let {
            conditions += "f.opprettet >= ?"
            parameters += Timestamp.from(
                LocalDate.parse(it).atStartOfDay(OSLO_ZONE).toInstant()
            )
        }
        query.toDate?.let {
            conditions += "f.opprettet < ?"
            parameters += Timestamp.from(
                LocalDate.parse(it).plusDays(1).atStartOfDay(OSLO_ZONE).toInstant()
            )
        }
        query.deviceType?.let {
            conditions += "f.feedback_json->'context'->>'deviceType' = ?"
            parameters += it
        }

        query.segments.forEach { (key, value) ->
            conditions += "jsonb_extract_path_text(f.feedback_json, 'context', 'tags', ?) = ?"
            parameters += key.trim()
            parameters += value.trim()
        }

        query.task?.let { taskId ->
            conditions += """
                f.feedback_json->>'surveyType' = 'topTasks'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(f.feedback_json->'answers') = 'array'
                            THEN f.feedback_json->'answers' ELSE '[]'::jsonb END
                    ) task_answer
                    WHERE task_answer->>'fieldId' = 'task'
                      AND task_answer->'value'->>'type' = 'singleChoice'
                      AND task_answer->'value'->>'selectedOptionId' = ?
                )
            """.trimIndent()
            parameters += taskId
        }

        query.ratingFilters.forEach { (filterFieldId, rating) ->
            conditions += """
                EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(f.feedback_json->'answers') = 'array'
                            THEN f.feedback_json->'answers' ELSE '[]'::jsonb END
                    ) filter_answer
                    WHERE filter_answer->>'fieldId' = ?
                      AND filter_answer->'value'->>'type' = 'rating'
                      AND filter_answer->'value'->>'rating' ~ '^-?[0-9]+$'
                      AND (filter_answer->'value'->>'rating')::int = ?
                )
            """.trimIndent()
            parameters += filterFieldId
            parameters += rating
        }

        query.choiceFilters.forEach { (filterFieldId, optionId) ->
            conditions += """
                EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(f.feedback_json->'answers') = 'array'
                            THEN f.feedback_json->'answers' ELSE '[]'::jsonb END
                    ) filter_answer
                    WHERE filter_answer->>'fieldId' = ?
                      AND (
                          (
                              filter_answer->'value'->>'type' = 'singleChoice'
                              AND filter_answer->'value'->>'selectedOptionId' = ?
                          )
                          OR (
                              filter_answer->'value'->>'type' = 'multiChoice'
                              AND EXISTS (
                                  SELECT 1
                                  FROM jsonb_array_elements_text(
                                      CASE WHEN jsonb_typeof(filter_answer->'value'->'selectedOptionIds') = 'array'
                                          THEN filter_answer->'value'->'selectedOptionIds' ELSE '[]'::jsonb END
                                  ) selected(option_id)
                                  WHERE selected.option_id = ?
                              )
                          )
                      )
                )
            """.trimIndent()
            parameters += filterFieldId
            parameters += optionId
            parameters += optionId
        }

        parameters += granularity.postgresUnit
        parameters += fieldId

        statement = """
            WITH filtered AS (
                SELECT f.id, f.opprettet, f.feedback_json
                FROM feedback f
                WHERE ${conditions.joinToString("\n                  AND ")}
            ), answers AS (
                SELECT
                    filtered.id AS feedback_id,
                    date_trunc(?, filtered.opprettet AT TIME ZONE 'Europe/Oslo')::date AS period_start,
                    answer.value AS answer
                FROM filtered
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE WHEN jsonb_typeof(filtered.feedback_json->'answers') = 'array'
                        THEN filtered.feedback_json->'answers' ELSE '[]'::jsonb END
                ) answer(value)
                WHERE answer.value->>'fieldId' = ?
            ), answered AS (
                SELECT feedback_id, period_start, answer->'value' AS value
                FROM answers
                WHERE (
                    answer->'value'->>'type' = 'rating'
                    AND answer->'value'->>'rating' ~ '^-?[0-9]+$'
                ) OR (
                    answer->'value'->>'type' = 'singleChoice'
                    AND COALESCE(answer->'value'->>'selectedOptionId', '') <> ''
                ) OR (
                    answer->'value'->>'type' = 'multiChoice'
                    AND jsonb_typeof(answer->'value'->'selectedOptionIds') = 'array'
                    AND jsonb_array_length(answer->'value'->'selectedOptionIds') > 0
                )
            ), bucket_stats AS (
                SELECT
                    period_start,
                    COUNT(DISTINCT feedback_id)::int AS response_count,
                    AVG(
                        CASE WHEN value->>'type' = 'rating'
                            THEN (value->>'rating')::numeric END
                    ) AS rating_average
                FROM answered
                GROUP BY period_start
            ), selections AS (
                SELECT answered.feedback_id, answered.period_start, selected.option_id
                FROM answered
                CROSS JOIN LATERAL (
                    SELECT answered.value->>'selectedOptionId' AS option_id
                    WHERE answered.value->>'type' = 'singleChoice'
                    UNION ALL
                    SELECT multi_option.option_id
                    FROM jsonb_array_elements_text(
                        CASE WHEN jsonb_typeof(answered.value->'selectedOptionIds') = 'array'
                            THEN answered.value->'selectedOptionIds' ELSE '[]'::jsonb END
                    ) multi_option(option_id)
                    WHERE answered.value->>'type' = 'multiChoice'
                ) selected
                WHERE selected.option_id IS NOT NULL AND selected.option_id <> ''
            ), selection_stats AS (
                SELECT period_start, option_id, COUNT(DISTINCT feedback_id)::int AS option_count
                FROM selections
                GROUP BY period_start, option_id
            )
            SELECT
                bucket_stats.period_start,
                bucket_stats.response_count,
                bucket_stats.rating_average,
                selection_stats.option_id,
                COALESCE(selection_stats.option_count, 0)::int AS option_count
            FROM bucket_stats
            LEFT JOIN selection_stats USING (period_start)
            ORDER BY bucket_stats.period_start, selection_stats.option_id
        """.trimIndent()
    }

    fun bind(statement: PreparedStatement) {
        parameters.forEachIndexed { index, value ->
            when (value) {
                is String -> statement.setString(index + 1, value)
                is Int -> statement.setInt(index + 1, value)
                is Timestamp -> statement.setTimestamp(index + 1, value)
                else -> error("Unsupported field trend SQL parameter: ${value::class.simpleName}")
            }
        }
    }

    private companion object {
        val OSLO_ZONE: ZoneId = ZoneId.of("Europe/Oslo")
    }
}
