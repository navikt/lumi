package no.nav.lumi.repository

import kotlinx.serialization.json.*
import no.nav.lumi.domain.*
import no.nav.lumi.sensitive.SensitiveDataFilter
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import kotlin.math.roundToInt

/** SQL counts stay exact; only free-text language analysis uses a bounded latest-response sample. */
internal class StructuredFieldStatsRepository {
    private val json = Json { ignoreUnknownKeys = true }
    private val connection get() = TransactionManager.current().connection.connection as Connection

    internal data class CatalogField(
        val definition: FieldDefinition,
        val label: String,
        val optionLabels: Map<String, String>,
    )

    /** Legacy submissions can predate or disagree with today's registered structure. */
    fun ratingSemantics(query: StatsQuery): Map<String, Pair<RatingVariant?, Int?>> {
        val filters = QuestionTrendSqlFilters(query)
        val result = mutableMapOf<String, Pair<RatingVariant?, Int?>>()
        val sql = """
            WITH ratings AS (
                SELECT a.value->>'fieldId' AS field_id, a.value->'value'->>'ratingVariant' AS variant,
                       COALESCE(a.value->'value'->>'ratingScale', CASE a.value->'value'->>'ratingVariant'
                           WHEN 'nps' THEN '11' WHEN 'thumbs' THEN '2' WHEN 'emoji' THEN '5' WHEN 'stars' THEN '5' END) AS scale
                FROM feedback f CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.feedback_json->'answers', '[]'::jsonb)) a(value)
                WHERE ${filters.whereSql} AND a.value->'value'->>'type' = 'rating'
            ) SELECT field_id, MIN(variant) AS variant, MIN(scale) AS scale,
                     COUNT(DISTINCT COALESCE(variant, '?') || ':' || COALESCE(scale, '?')) AS contracts,
                     BOOL_AND(variant IS NOT NULL AND scale IS NOT NULL) AS explicit
              FROM ratings GROUP BY field_id
        """.trimIndent()
        connection.prepareStatement(sql).use { statement ->
            statement.bind(filters.parameters)
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    val variant = rows.getString("variant")?.let { value -> RatingVariant.entries.find { it.name.equals(value, true) } }
                    val scale = rows.getString("scale")?.toIntOrNull()
                    val valid = rows.getInt("contracts") == 1 && rows.getBoolean("explicit") &&
                        variant != null && scale == RatingVariant.getScale(variant)
                    result[rows.getString("field_id")] = if (valid) variant to scale else null to null
                }
            }
        }
        return result
    }

    fun catalog(query: StatsQuery): List<CatalogField> {
        val surveyId = query.surveyId ?: return emptyList()
        if (!query.includeArchived) {
            connection.prepareStatement("SELECT 1 FROM survey_metadata WHERE team = ? AND survey_id = ? AND archived_at IS NOT NULL").use { statement ->
                statement.bind(listOf(query.team, surveyId))
                statement.executeQuery().use { if (it.next()) return emptyList() }
            }
        }
        // Labels belong to the selected source, not the selected period or answer filters.
        val scope = QuestionTrendSqlFilters(StatsQuery(
            team = query.team, app = query.app, surveyId = surveyId, includeArchived = query.includeArchived,
        ))
        val observed = linkedMapOf<String, CatalogField>()
        val sql = """
            WITH answers AS (
                SELECT f.id, f.opprettet, a.value, a.position,
                       jsonb_array_length(f.feedback_json->'answers') AS field_count
                FROM feedback f CROSS JOIN LATERAL jsonb_array_elements(
                    COALESCE(f.feedback_json->'answers', '[]'::jsonb)
                ) WITH ORDINALITY a(value, position)
                WHERE ${scope.whereSql}
            ), latest AS (
                SELECT DISTINCT ON (value->>'fieldId')
                       value->>'fieldId' AS field_id, value->>'fieldType' AS field_type,
                       value->'question' AS question,
                       value->'value'->>'ratingVariant' AS rating_variant,
                       value->'value'->>'ratingScale' AS rating_scale
                FROM answers ORDER BY value->>'fieldId', opprettet DESC, id DESC
            ), ordering AS (
                SELECT DISTINCT ON (value->>'fieldId') value->>'fieldId' AS field_id, position,
                       field_count, opprettet, id
                FROM answers ORDER BY value->>'fieldId', field_count DESC, opprettet DESC, id DESC
            )
            SELECT latest.* FROM latest JOIN ordering USING (field_id)
            ORDER BY ordering.field_count DESC, ordering.opprettet DESC, ordering.id DESC, ordering.position
        """.trimIndent()
        connection.prepareStatement(sql).use { statement ->
            statement.bind(scope.parameters)
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    val id = rows.getString("field_id") ?: continue
                    val type = runCatching { FieldType.valueOf(rows.getString("field_type")) }.getOrNull() ?: continue
                    val question = rows.getString("question")?.let { json.parseToJsonElement(it).jsonObject }
                    val options = question?.get("options")?.takeUnless { it is JsonNull }?.jsonArray.orEmpty()
                        .associate { it.jsonObject.getValue("id").jsonPrimitive.content to it.jsonObject.getValue("label").jsonPrimitive.content }
                    val variant = rows.getString("rating_variant")?.let { value ->
                        RatingVariant.entries.find { it.name.equals(value, ignoreCase = true) }
                    }
                    observed[id] = CatalogField(
                        FieldDefinition(id, type, variant, rows.getString("rating_scale")?.toIntOrNull()
                            ?: variant?.let(RatingVariant::getScale), options.keys.toList()),
                        question?.get("label")?.jsonPrimitive?.content?.takeIf(String::isNotBlank) ?: id,
                        options,
                    )
                }
            }
        }
        // Definitions are team-scoped. An app filter must have evidence that this source exists.
        if (query.app != null && observed.isEmpty()) return emptyList()
        val stored = SurveyDefinitionRepository().findByTeamAndSurveyIdInCurrentTransaction(query.team, surveyId)
        val definition = stored?.takeIf { it.retiredAt == null && it.source == SurveyDefinitionSource.API }?.definition
            ?: return observed.values.toList()
        return definition.fields.map { field ->
            val labels = observed[field.fieldId]
            CatalogField(field, labels?.label ?: field.fieldId, labels?.optionLabels.orEmpty())
        }
    }

    fun getFieldStats(query: StatsQuery): List<FieldStat> {
        val catalog = catalog(query)
        if (catalog.isEmpty()) return emptyList()
        val filters = QuestionTrendSqlFilters(query)
        val counts = mutableMapOf<String, MutableMap<String, Int>>()
        val responseCounts = mutableMapOf<String, Int>()
        val observedTypes = mutableMapOf<String, String?>()
        var total = 0
        val sql = """
            WITH filtered AS MATERIALIZED (SELECT f.id, f.feedback_json FROM feedback f WHERE ${filters.whereSql}),
            answers AS MATERIALIZED (
                SELECT f.id, a.value AS answer FROM filtered f
                CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.feedback_json->'answers', '[]'::jsonb)) a(value)
            ), selections AS (
                SELECT DISTINCT id, answer->>'fieldId' AS field_id, selection.value
                FROM answers CROSS JOIN LATERAL (
                    SELECT answer->'value'->>'rating' AS value WHERE answer->'value'->>'type' = 'rating'
                    UNION ALL
                    SELECT answer->'value'->>'selectedOptionId' WHERE answer->'value'->>'type' = 'singleChoice'
                    UNION ALL
                    SELECT jsonb_array_elements_text(COALESCE(answer->'value'->'selectedOptionIds', '[]'::jsonb))
                    WHERE answer->'value'->>'type' = 'multiChoice'
                    UNION ALL
                    SELECT '' WHERE answer->'value'->>'type' = 'text' AND answer->'value'->>'text' ~ '[^[:space:]]'
                ) selection WHERE selection.value IS NOT NULL
            ), field_types AS (
                SELECT answer->>'fieldId' AS field_id, COUNT(DISTINCT answer->>'fieldType') AS type_count,
                       MIN(answer->>'fieldType') AS field_type FROM answers GROUP BY answer->>'fieldId'
            ), response_counts AS (SELECT field_id, COUNT(DISTINCT id)::integer AS responses FROM selections GROUP BY field_id),
            value_counts AS (SELECT field_id, value, COUNT(*)::integer AS count FROM selections GROUP BY field_id, value)
            SELECT (SELECT COUNT(*)::integer FROM filtered) AS total, value_counts.*, response_counts.responses,
                   field_types.type_count, field_types.field_type
            FROM value_counts JOIN response_counts USING (field_id) JOIN field_types USING (field_id)
        """.trimIndent()
        connection.prepareStatement(sql).use { statement ->
            statement.bind(filters.parameters)
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    total = rows.getInt("total")
                    val id = rows.getString("field_id")
                    responseCounts[id] = rows.getInt("responses")
                    observedTypes[id] = rows.getString("field_type").takeIf { rows.getInt("type_count") == 1 }
                    counts.getOrPut(id) { linkedMapOf() }[rows.getString("value")] = rows.getInt("count")
                }
            }
        }
        val textStats = sampleTextStats(query, filters)
        val ratingSemantics = ratingSemantics(query)
        return catalog.mapNotNull { field ->
            val definition = field.definition
            if (definition.fieldId in observedTypes && observedTypes[definition.fieldId] != definition.fieldType.name) {
                return@mapNotNull null
            }
            val distribution = counts[definition.fieldId].orEmpty()
            val responseCount = responseCounts[definition.fieldId] ?: 0
            val rate = if (total == 0) 0.0 else responseCount.toDouble() / total
            val stats = when (definition.fieldType) {
                FieldType.RATING -> {
                    val ratings = distribution.filterKeys { it.toIntOrNull() != null }
                    val count = ratings.values.sum()
                    val semantics = ratingSemantics[definition.fieldId] ?: (definition.ratingVariant to definition.ratingScale)
                    FieldStats.Rating(
                        average = if (count == 0) 0.0 else ratings.entries.sumOf { it.key.toDouble() * it.value } / count,
                        distribution = ratings, ratingVariant = semantics.first, ratingScale = semantics.second,
                    )
                }
                FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE -> FieldStats.Choice(
                    responseCount = responseCount, responseRate = rate, totalSelections = distribution.values.sum(),
                    distribution = (definition.optionIds.orEmpty() + distribution.keys).distinct().associateWith { id ->
                        val count = distribution[id] ?: 0
                        ChoiceDistributionEntry(field.optionLabels[id] ?: id, count,
                            if (responseCount == 0) 0 else (100.0 * count / responseCount).roundToInt())
                    },
                )
                FieldType.TEXT -> {
                    val sample = textStats[definition.fieldId]
                    (sample ?: FieldStats.Text(0, 0.0)).copy(
                        responseCount = responseCount, responseRate = rate,
                        analysisSampleSize = (sample?.responseCount ?: 0).takeIf { it < responseCount },
                    )
                }
                else -> return@mapNotNull null
            }
            FieldStat(definition.fieldId, definition.fieldType, field.label, stats)
        }
    }

    private fun sampleTextStats(query: StatsQuery, filters: QuestionTrendSqlFilters): Map<String, FieldStats.Text> {
        val records = mutableListOf<FeedbackDto>()
        val sql = """
            WITH texts AS (
                SELECT f.id, f.opprettet, a.value->>'fieldId' AS field_id,
                       a.value->'value'->>'text' AS text,
                       ROW_NUMBER() OVER (PARTITION BY a.value->>'fieldId' ORDER BY f.opprettet DESC, f.id DESC) AS position
                FROM feedback f CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.feedback_json->'answers', '[]'::jsonb)) a(value)
                WHERE ${filters.whereSql} AND a.value->'value'->>'type' = 'text'
                  AND a.value->'value'->>'text' ~ '[^[:space:]]'
            ), bounded AS (
                SELECT *, SUM(octet_length(text)) OVER (ORDER BY position, field_id) AS sample_bytes,
                       ROW_NUMBER() OVER (ORDER BY position, field_id) AS sample_position
                FROM texts WHERE position <= 1000
            ) SELECT id, opprettet, field_id, text FROM bounded
              WHERE sample_bytes <= 4194304 AND sample_position <= 5000
        """.trimIndent()
        connection.prepareStatement(sql).use { statement ->
            statement.bind(filters.parameters)
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    val id = rows.getString("field_id")
                    val text = SensitiveDataFilter.DEFAULT.redact(rows.getString("text")).redactedText
                    records += FeedbackDto(
                        id = rows.getString("id"), submittedAt = rows.getTimestamp("opprettet").toInstant().toString(),
                        app = query.app, surveyId = query.surveyId.orEmpty(),
                        answers = listOf(Answer(id, FieldType.TEXT, Question(label = id), AnswerValue.Text(text))),
                    )
                }
            }
        }
        return buildFieldStats(records).associate { it.fieldId to it.stats as FieldStats.Text }
    }
}
