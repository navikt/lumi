package no.nav.lumi.repository

import no.nav.lumi.domain.FieldType
import no.nav.lumi.domain.QuestionTrendBucket
import no.nav.lumi.domain.QuestionTrendChoiceValue
import no.nav.lumi.domain.QuestionTrendInterval
import no.nav.lumi.domain.QuestionTrendOption
import no.nav.lumi.domain.QuestionTrendResponse
import no.nav.lumi.domain.StatsQuery
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.Timestamp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.round

class QuestionTrendRepository {
    suspend fun getQuestionTrend(
        query: StatsQuery,
        fieldId: String,
        interval: QuestionTrendInterval,
    ): QuestionTrendResult? = dbQuery {
        val filters = QuestionTrendSqlFilters(query)
        val bucketUnit = when (interval) {
            QuestionTrendInterval.DAY -> "day"
            QuestionTrendInterval.WEEK -> "week"
            QuestionTrendInterval.MONTH -> "month"
        }
        val sql = buildQuestionTrendSql(filters.whereSql, bucketUnit)
        val parameters = filters.parameters + fieldId
        val connection = TransactionManager.current().connection.connection as Connection

        connection.prepareStatement(sql).use { statement ->
            statement.fetchSize = 256
            statement.bind(parameters)
            statement.executeQuery().use { resultSet ->
                var fieldType: FieldType? = null
                var label: String? = null
                var fieldTypeCount = 0
                val options = linkedMapOf<String, QuestionTrendOption>()
                val buckets = linkedMapOf<String, MutableTrendBucket>()

                while (resultSet.next()) {
                    fieldType = FieldType.valueOf(resultSet.getString("field_type"))
                    label = resultSet.getString("field_label")
                    fieldTypeCount = resultSet.getInt("field_type_count")

                    val startDate = resultSet.getObject("bucket_start", LocalDate::class.java).toString()
                    val responseCount = resultSet.getInt("response_count")
                    val masked = responseCount in 1 until FeedbackStatsRepository.MIN_AGGREGATION_THRESHOLD
                    val bucket = buckets.getOrPut(startDate) {
                        MutableTrendBucket(
                            startDate = startDate,
                            masked = masked,
                            responseCount = responseCount.takeUnless { masked },
                            average = resultSet
                                .getDouble("rating_average")
                                .takeUnless { resultSet.wasNull() || masked },
                        )
                    }

                    val optionId = resultSet.getString("option_id") ?: continue
                    val optionLabel = resultSet.getString("option_label") ?: optionId
                    options.putIfAbsent(optionId, QuestionTrendOption(id = optionId, label = optionLabel))
                    if (!masked) {
                        val count = resultSet.getInt("option_count")
                        val percentage = if (responseCount > 0) {
                            round(count.toDouble() * 1_000.0 / responseCount) / 10.0
                        } else {
                            0.0
                        }
                        bucket.distribution[optionId] = QuestionTrendChoiceValue(
                            count = count,
                            percentage = percentage,
                        )
                    }
                }

                val resolvedFieldType = fieldType ?: return@dbQuery null
                QuestionTrendResult(
                    fieldTypeCount = fieldTypeCount,
                    response = QuestionTrendResponse(
                        fieldId = fieldId,
                        fieldType = resolvedFieldType,
                        label = label ?: fieldId,
                        interval = interval,
                        privacyThreshold = FeedbackStatsRepository.MIN_AGGREGATION_THRESHOLD,
                        options = options.values.toList(),
                        buckets = buckets.values.map { bucket ->
                            QuestionTrendBucket(
                                startDate = bucket.startDate,
                                masked = bucket.masked,
                                responseCount = bucket.responseCount,
                                average = bucket.average,
                                distribution = bucket.distribution,
                            )
                        },
                    ),
                )
            }
        }
    }

    data class QuestionTrendResult(
        val fieldTypeCount: Int,
        val response: QuestionTrendResponse,
    )

    private data class MutableTrendBucket(
        val startDate: String,
        val masked: Boolean,
        val responseCount: Int?,
        val average: Double?,
        val distribution: LinkedHashMap<String, QuestionTrendChoiceValue> = linkedMapOf(),
    )
}

private class QuestionTrendSqlFilters(query: StatsQuery) {
    private val clauses = mutableListOf("f.team = ?")
    val parameters = mutableListOf<Any>(query.team)

    val whereSql: String
        get() = clauses.joinToString("\n                  AND ")

    init {
        if (!query.includeArchived) {
            clauses += """
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
            clauses += "f.app = ?"
            parameters += it
        }
        query.surveyId?.let {
            clauses += "f.feedback_json->>'surveyId' = ?"
            parameters += it
        }
        query.fromDate?.let {
            clauses += "f.opprettet >= ?"
            parameters += startOfOsloDay(it)
        }
        query.toDate?.let {
            clauses += "f.opprettet < ?"
            parameters += LocalDate.parse(it).plusDays(1).atStartOfDay(OSLO_ZONE).toInstant()
        }
        query.deviceType?.let {
            clauses += "f.feedback_json->'context'->>'deviceType' = ?"
            parameters += it
        }
        query.segments.forEach { (key, value) ->
            clauses += "jsonb_extract_path_text(f.feedback_json, 'context', 'tags', ?) = ?"
            parameters += key.trim()
            parameters += value.trim()
        }
        query.task?.let { addChoiceFilter("task", it) }
        query.ratingFilters.forEach { (filterFieldId, rating) ->
            clauses += """
                EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(f.feedback_json->'answers', '[]'::jsonb)) AS filter_answer(value)
                    WHERE filter_answer.value->>'fieldId' = ?
                      AND filter_answer.value->'value'->>'type' = 'rating'
                      AND filter_answer.value->'value'->>'rating' ~ '^-?[0-9]+$'
                      AND (filter_answer.value->'value'->>'rating')::integer = ?
                )
            """.trimIndent()
            parameters += filterFieldId
            parameters += rating
        }
        query.choiceFilters.forEach { (filterFieldId, optionId) ->
            addChoiceFilter(filterFieldId, optionId)
        }
    }

    private fun addChoiceFilter(fieldId: String, optionId: String) {
        clauses += """
            EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(f.feedback_json->'answers', '[]'::jsonb)) AS filter_answer(value)
                WHERE filter_answer.value->>'fieldId' = ?
                  AND (
                      (
                          filter_answer.value->'value'->>'type' = 'singleChoice'
                          AND filter_answer.value->'value'->>'selectedOptionId' = ?
                      )
                      OR (
                          filter_answer.value->'value'->>'type' = 'multiChoice'
                          AND jsonb_exists(
                              COALESCE(filter_answer.value->'value'->'selectedOptionIds', '[]'::jsonb),
                              ?
                          )
                      )
                  )
            )
        """.trimIndent()
        parameters += fieldId
        parameters += optionId
        parameters += optionId
    }

    private fun startOfOsloDay(value: String): Instant =
        LocalDate.parse(value).atStartOfDay(OSLO_ZONE).toInstant()
}

private fun PreparedStatement.bind(parameters: List<Any>) {
    parameters.forEachIndexed { index, value ->
        when (value) {
            is String -> setString(index + 1, value)
            is Int -> setInt(index + 1, value)
            is Instant -> setTimestamp(index + 1, Timestamp.from(value))
            else -> setObject(index + 1, value)
        }
    }
}

private fun buildQuestionTrendSql(whereSql: String, bucketUnit: String): String = """
    WITH filtered AS MATERIALIZED (
        SELECT f.id, f.opprettet, f.feedback_json
        FROM feedback f
        WHERE $whereSql
    ),
    answers AS MATERIALIZED (
        SELECT
            f.id,
            f.opprettet,
            answer.value AS answer,
            date_trunc('$bucketUnit', f.opprettet AT TIME ZONE 'Europe/Oslo')::date AS bucket_start
        FROM filtered f
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(f.feedback_json->'answers', '[]'::jsonb)
        ) AS answer(value)
        WHERE answer.value->>'fieldId' = ?
          AND answer.value->>'fieldType' IN ('RATING', 'SINGLE_CHOICE', 'MULTI_CHOICE')
    ),
    type_summary AS (
        SELECT COUNT(DISTINCT answer->>'fieldType')::integer AS field_type_count
        FROM answers
    ),
    selected_field AS (
        SELECT
            answer->>'fieldType' AS field_type,
            COALESCE(NULLIF(answer->'question'->>'label', ''), answer->>'fieldId') AS field_label
        FROM answers
        ORDER BY opprettet DESC, id DESC
        LIMIT 1
    ),
    typed_answers AS MATERIALIZED (
        SELECT answers.*
        FROM answers
        CROSS JOIN selected_field
        WHERE answers.answer->>'fieldType' = selected_field.field_type
    ),
    rating_values AS (
        SELECT
            id,
            bucket_start,
            CASE
                WHEN answer->'value'->>'type' = 'rating'
                 AND answer->'value'->>'rating' ~ '^-?[0-9]+$'
                THEN (answer->'value'->>'rating')::double precision
            END AS rating
        FROM typed_answers
        WHERE answer->>'fieldType' = 'RATING'
    ),
    choice_selections AS MATERIALIZED (
        SELECT DISTINCT
            typed_answers.id,
            typed_answers.bucket_start,
            selection.option_id
        FROM typed_answers
        CROSS JOIN LATERAL (
            SELECT typed_answers.answer->'value'->>'selectedOptionId' AS option_id
            WHERE typed_answers.answer->>'fieldType' = 'SINGLE_CHOICE'
              AND typed_answers.answer->'value'->>'type' = 'singleChoice'
            UNION ALL
            SELECT jsonb_array_elements_text(
                COALESCE(typed_answers.answer->'value'->'selectedOptionIds', '[]'::jsonb)
            ) AS option_id
            WHERE typed_answers.answer->>'fieldType' = 'MULTI_CHOICE'
              AND typed_answers.answer->'value'->>'type' = 'multiChoice'
        ) AS selection
        WHERE NULLIF(selection.option_id, '') IS NOT NULL
    ),
    bucket_summary AS (
        SELECT
            bucket_start,
            COUNT(*)::integer AS response_count,
            AVG(rating) AS rating_average
        FROM rating_values
        WHERE rating IS NOT NULL
        GROUP BY bucket_start
        UNION ALL
        SELECT
            bucket_start,
            COUNT(DISTINCT id)::integer AS response_count,
            NULL::double precision AS rating_average
        FROM choice_selections
        GROUP BY bucket_start
    ),
    option_catalog AS (
        SELECT DISTINCT ON (option.value->>'id')
            option.value->>'id' AS option_id,
            COALESCE(NULLIF(option.value->>'label', ''), option.value->>'id') AS option_label,
            option.position::integer AS option_order
        FROM typed_answers
        CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(typed_answers.answer->'question'->'options', '[]'::jsonb)
        ) WITH ORDINALITY AS option(value, position)
        WHERE typed_answers.answer->>'fieldType' IN ('SINGLE_CHOICE', 'MULTI_CHOICE')
          AND NULLIF(option.value->>'id', '') IS NOT NULL
        ORDER BY option.value->>'id', typed_answers.opprettet DESC, typed_answers.id DESC
    ),
    all_option_ids AS (
        SELECT option_id FROM option_catalog
        UNION
        SELECT option_id FROM choice_selections
    ),
    all_options AS (
        SELECT
            all_option_ids.option_id,
            COALESCE(option_catalog.option_label, all_option_ids.option_id) AS option_label,
            COALESCE(option_catalog.option_order, 2147483647) AS option_order
        FROM all_option_ids
        LEFT JOIN option_catalog USING (option_id)
    ),
    option_counts AS (
        SELECT
            bucket_start,
            option_id,
            COUNT(DISTINCT id)::integer AS option_count
        FROM choice_selections
        GROUP BY bucket_start, option_id
    )
    SELECT
        selected_field.field_type,
        selected_field.field_label,
        type_summary.field_type_count,
        bucket_summary.bucket_start,
        bucket_summary.response_count,
        bucket_summary.rating_average,
        all_options.option_id,
        all_options.option_label,
        COALESCE(option_counts.option_count, 0)::integer AS option_count
    FROM selected_field
    CROSS JOIN type_summary
    CROSS JOIN bucket_summary
    LEFT JOIN all_options
      ON selected_field.field_type IN ('SINGLE_CHOICE', 'MULTI_CHOICE')
    LEFT JOIN option_counts
      ON option_counts.bucket_start = bucket_summary.bucket_start
     AND option_counts.option_id = all_options.option_id
    ORDER BY bucket_summary.bucket_start, all_options.option_order, all_options.option_id
""".trimIndent()

private val OSLO_ZONE: ZoneId = ZoneId.of("Europe/Oslo")
