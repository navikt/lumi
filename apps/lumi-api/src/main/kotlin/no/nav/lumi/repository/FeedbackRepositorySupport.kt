package no.nav.lumi.repository

import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.config.exception.ErrorType
import no.nav.lumi.domain.*
import no.nav.lumi.service.TextProcessor
import org.jetbrains.exposed.v1.core.*
import org.jetbrains.exposed.v1.jdbc.*
import org.slf4j.Logger
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.ZoneId

internal const val MAX_IN_MEMORY_ANALYSIS_ROWS = 10_000
// Raw JSON is retained while DTOs are decoded. Keep the per-request budget low
// enough to leave headroom for decoded objects and concurrent DB-pool workers.
internal const val MAX_IN_MEMORY_ANALYSIS_JSON_BYTES = 8L * 1024 * 1024
private const val IN_MEMORY_ANALYSIS_FETCH_SIZE = 8

private class JsonTextOctetLength(
    private val expression: Expression<*>,
) : org.jetbrains.exposed.v1.core.Function<Long>(LongColumnType()) {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("OCTET_LENGTH(CAST(")
        expression.toQueryBuilder(queryBuilder)
        queryBuilder.append(" AS VARCHAR))")
    }
}

/**
 * Uses a SQL-side row/byte preflight before any feedback JSON crosses into the
 * JVM, then streams small JDBC batches and re-checks the byte budget while
 * materializing. The second check closes the race between preflight and fetch.
 */
internal fun Query.materializeFeedbackForAnalysis(
    maxRows: Int = MAX_IN_MEMORY_ANALYSIS_ROWS,
    maxJsonBytes: Long = MAX_IN_MEMORY_ANALYSIS_JSON_BYTES,
): List<FeedbackDbRecord> {
    require(maxRows in 1 until Int.MAX_VALUE) { "maxRows must be a positive integer" }
    require(maxJsonBytes > 0) { "maxJsonBytes must be positive" }

    val jsonBytes = JsonTextOctetLength(FeedbackTable.feedbackJson).alias("json_bytes")
    val boundedRows = copy()
        .adjustSelect { select(jsonBytes) }
        .limit(maxRows + 1)
        .alias("bounded_analysis_rows")
    val boundedJsonBytes = boundedRows[jsonBytes]
    val rowCount = boundedJsonBytes.count()
    val totalJsonBytes = boundedJsonBytes.sum()
    val budget = boundedRows
        .select(rowCount, totalJsonBytes)
        .single()

    if (budget[rowCount] > maxRows || (budget[totalJsonBytes] ?: 0L) > maxJsonBytes) {
        throwAnalysisBudgetExceeded(maxRows, maxJsonBytes)
    }

    val records = ArrayList<FeedbackDbRecord>(minOf(maxRows, 1_024))
    var materializedJsonBytes = 0L
    limit(maxRows + 1)
        .fetchSize(IN_MEMORY_ANALYSIS_FETCH_SIZE)
        .forEach { row ->
            if (records.size >= maxRows) {
                throwAnalysisBudgetExceeded(maxRows, maxJsonBytes)
            }

            val record = row.toDbRecord()
            materializedJsonBytes += record.feedbackJson
                .toByteArray(StandardCharsets.UTF_8)
                .size
            if (materializedJsonBytes > maxJsonBytes) {
                throwAnalysisBudgetExceeded(maxRows, maxJsonBytes)
            }
            records.add(record)
        }

    return records
}

private fun throwAnalysisBudgetExceeded(maxRows: Int, maxJsonBytes: Long): Nothing {
    val maxJsonMiB = maxJsonBytes / (1024 * 1024)
    throw ApiErrorException.BadRequestException(
        "Too much feedback data for in-memory analysis " +
            "(max $maxRows responses and $maxJsonMiB MiB total JSON size). " +
            "Narrow the date range or add filters.",
        type = ErrorType.ANALYSIS_BUDGET_EXCEEDED,
    )
}

internal fun applyContextTagAnalysisFilters(
    query: Query,
    segments: List<Pair<String, String>>,
    fromDate: String?,
    toDate: String?,
    deviceType: String?,
    hasText: Boolean,
    lowRating: Boolean,
) {
    segments.forEach { (key, value) ->
        val safeKey = key.trim()
        val safeValue = value.trim()
        if (safeKey.isNotBlank() && safeValue.isNotBlank()) {
            query.andWhere {
                JsonExtract(FeedbackTable.feedbackJson, listOf("context", "tags", safeKey)) eq safeValue
            }
        }
    }

    fromDate?.takeIf { it.isNotBlank() }?.let { value ->
        runCatching { LocalDate.parse(value) }.getOrNull()?.let { date ->
            val startOfDay = date.atStartOfDay(ZoneId.of("Europe/Oslo")).toInstant()
            query.andWhere { FeedbackTable.opprettet greaterEq startOfDay }
        }
    }
    toDate?.takeIf { it.isNotBlank() }?.let { value ->
        runCatching { LocalDate.parse(value) }.getOrNull()?.let { date ->
            val nextDayStart = date.plusDays(1)
                .atStartOfDay(ZoneId.of("Europe/Oslo"))
                .toInstant()
            query.andWhere { FeedbackTable.opprettet less nextDayStart }
        }
    }

    deviceType?.takeIf { it.isNotBlank() }?.let { device ->
        query.andWhere {
            JsonExtract(FeedbackTable.feedbackJson, listOf("context", "deviceType")) eq device
        }
    }

    if (hasText) {
        query.andWhere {
            JsonbPathExists(
                FeedbackTable.feedbackJson,
                "$.answers[*] ? (@.value.type == \"text\" && @.value.text != \"\")"
            )
        }
    }

    if (lowRating) {
        val ratingText = JsonbPathQueryFirstText(
            FeedbackTable.feedbackJson,
            "$.answers[*] ? (@.value.type == \"rating\").value.rating"
        )
        val ratingExpr = Cast(ratingText, IntegerColumnType())
        query.andWhere { ratingExpr lessEq 2 }
    }
}

/**
 * Escape special characters for SQL LIKE patterns to prevent SQL injection.
 * Escapes %, _, and \ which have special meaning in LIKE clauses.
 */
internal fun String.escapeLikePattern(): String {
    return this
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
}

internal fun applyCommonFilters(query: Query, criteria: FeedbackQuery, log: Logger) {
    if (!criteria.includeArchived) {
        query.andWhere { SurveyIsNotArchived() }
    }

    // Filter for feedback with text responses
    if (criteria.hasText) {
        query.andWhere {
            JsonbPathExists(
                FeedbackTable.feedbackJson,
                "$.answers[*] ? (@.value.type == \"text\" && @.value.text != \"\")"
            )
        }
    }

    // Filter by survey ID
    criteria.surveyId?.let { surveyId ->
        query.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("surveyId")) eq surveyId }
    }

    // Date range filter - convert YYYY-MM-DD to UTC instants (Europe/Oslo).
    criteria.fromDate?.let { fromDate ->
        try {
            val localDate = LocalDate.parse(fromDate)
            val startOfDay = localDate.atStartOfDay(ZoneId.of("Europe/Oslo")).toInstant()
            query.andWhere { FeedbackTable.opprettet greaterEq startOfDay }
        } catch (e: Exception) {
            log.warn("Invalid fromDate format: $fromDate, expected YYYY-MM-DD")
        }
    }

    criteria.toDate?.let { toDate ->
        try {
            val localDate = LocalDate.parse(toDate)
            // Inclusive date filter: < start of next day (Europe/Oslo)
            val nextDayStart = localDate.plusDays(1)
                .atStartOfDay(ZoneId.of("Europe/Oslo"))
                .toInstant()
            query.andWhere { FeedbackTable.opprettet less nextDayStart }
        } catch (e: Exception) {
            log.warn("Invalid toDate format: $toDate, expected YYYY-MM-DD")
        }
    }

    // Filter for low ratings (1-2)
    if (criteria.lowRating) {
        val ratingText = JsonbPathQueryFirstText(
            FeedbackTable.feedbackJson,
            "$.answers[*] ? (@.value.type == \"rating\").value.rating"
        )
        val ratingExpr = Cast(ratingText, IntegerColumnType())
        query.andWhere { ratingExpr lessEq 2 }
    }

    // Device type filter
    criteria.deviceType?.let { device ->
        query.andWhere { JsonExtract(FeedbackTable.feedbackJson, listOf("context", "deviceType")) eq device }
    }

    // Tags filter
    criteria.tags.forEach { tag ->
        val normalized = normalizeTag(tag) ?: return@forEach
        query.andWhere { HasTagOp(FeedbackTable.id, normalized) }
    }

    // Full-text search query
    criteria.query?.let { searchQuery ->
        val escaped = searchQuery.escapeLikePattern()
        val pattern = "%$escaped%"
        val jsonText = Cast(FeedbackTable.feedbackJson, TextColumnType())
        query.andWhere { (jsonText like pattern) or HasTagLikeOp(FeedbackTable.id, pattern) }
    }

    // Segment filter (context.tags)
    criteria.segments.forEach { (key, value) ->
        val safeKey = key.trim()
        val safeValue = value.trim()
        if (safeKey.isBlank() || safeValue.isBlank()) return@forEach
        // Query JSONB context->tags->key = value
        query.andWhere {
            JsonExtract(FeedbackTable.feedbackJson, listOf("context", "tags", safeKey)) eq safeValue
        }
    }

    // Filter by specific rating answers (multi-value)
    criteria.ratingFilters.forEach { (fieldId, ratingVal) ->
        val safeFieldId = validateJsonPathFieldId(fieldId, "ratingFieldId", log)
        if (safeFieldId != null) {
            val ratingTextForField = JsonbPathQueryFirstText(
                FeedbackTable.feedbackJson,
                "$.answers[*] ? (@.fieldId == \"$safeFieldId\" && @.value.type == \"rating\").value.rating"
            )
            val ratingExpr = Cast(ratingTextForField, IntegerColumnType())
            query.andWhere { ratingExpr eq ratingVal }
        }
    }

    // Filter by specific choice answers (multi-value)
    criteria.choiceFilters.forEach { (fieldId, value) ->
        val choiceJsonPaths = buildChoiceJsonPaths(fieldId, value, log)
        if (choiceJsonPaths != null) {
            query.andWhere {
                JsonbPathExists(FeedbackTable.feedbackJson, choiceJsonPaths.singleChoicePath) or
                    JsonbPathExists(FeedbackTable.feedbackJson, choiceJsonPaths.multiChoicePath)
            }
        }
    }
}

internal fun normalizeTag(tag: String): String? {
    val normalized = tag.trim().lowercase()
    return normalized.takeIf { it.isNotBlank() }
}

internal fun matchesTaskFilter(feedback: FeedbackDto, task: String?): Boolean {
    if (task.isNullOrBlank()) return true

    val taskAnswer = SpecializedSurveyFieldIds.findTask(feedback.surveyType, feedback.answers)
    if (taskAnswer != null && taskAnswer.fieldType == FieldType.SINGLE_CHOICE) {
        val selectedId = (taskAnswer.value as? AnswerValue.SingleChoice)?.selectedOptionId
        return selectedId == task
    }
    return false
}

internal fun matchesThemeFilter(
    feedback: FeedbackDto,
    themeId: String?,
    themes: List<TextThemeDto>
): Boolean {
    if (themeId.isNullOrBlank()) return true

    val taskAnswer = SpecializedSurveyFieldIds.findTask(feedback.surveyType, feedback.answers)
    val taskText = (taskAnswer?.value as? AnswerValue.Text)?.text ?: return false

    if (themeId == "uncategorized") {
        return themes.none { themeMatchesText(taskText, it) }
    }

    val targetTheme = themes.find { it.id == themeId } ?: return false
    return themeMatchesText(taskText, targetTheme)
}

internal fun buildPhraseStemKey(surface: String): String {
    val words = TextProcessor.extractWords(surface)
    require(words.size == 2) { "Invalid phrase filter" }
    return "${TextProcessor.stemNorwegian(words[0])}|${TextProcessor.stemNorwegian(words[1])}"
}

internal fun matchesPhraseFieldId(
    actualFieldId: String,
    requestedFieldId: String,
    surveyType: SurveyType?,
): Boolean {
    if (actualFieldId == requestedFieldId) return true

    val discoveryTaskIds = setOf(
        SpecializedSurveyFieldIds.TASK,
        SpecializedSurveyFieldIds.LEGACY_DISCOVERY_TASK,
    )
    return surveyType == SurveyType.DISCOVERY &&
        actualFieldId in discoveryTaskIds &&
        requestedFieldId in discoveryTaskIds
}

internal fun matchesPhraseFilter(feedback: FeedbackDto, fieldId: String, expectedStemKey: String): Boolean {
    return feedback.answers
        .asSequence()
        .filter {
            matchesPhraseFieldId(it.fieldId, fieldId, feedback.surveyType) &&
                it.fieldType == FieldType.TEXT
        }
        .mapNotNull { (it.value as? AnswerValue.Text)?.text }
        .any { text ->
            TextProcessor.extractBigrams(text).any { it.stemKey == expectedStemKey }
        }
}

private fun themeMatchesText(text: String, theme: TextThemeDto): Boolean {
    return TextProcessor.matchesThemeKeywords(text, theme.keywords)
}

internal fun findTagsByFeedbackId(id: String): List<String> {
    return FeedbackTagTable
        .select(FeedbackTagTable.tag)
        .where { FeedbackTagTable.feedbackId eq id }
        .map { it[FeedbackTagTable.tag] }
        .sorted()
}

internal fun findTagsByFeedbackIds(ids: List<String>): Map<String, List<String>> {
    if (ids.isEmpty()) return emptyMap()

    val result = mutableMapOf<String, MutableList<String>>()
    FeedbackTagTable
        .select(FeedbackTagTable.feedbackId, FeedbackTagTable.tag)
        .where { FeedbackTagTable.feedbackId inList ids }
        .forEach { row ->
            val feedbackId = row[FeedbackTagTable.feedbackId]
            val tag = row[FeedbackTagTable.tag]
            result.getOrPut(feedbackId) { mutableListOf() }.add(tag)
        }

    return result.mapValues { (_, tags) -> tags.sorted() }
}

internal class HasTagOp(
    private val feedbackIdColumn: Column<String>,
    private val tag: String
) : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("EXISTS (SELECT 1 FROM feedback_tag WHERE feedback_tag.feedback_id = ")
        queryBuilder.append(feedbackIdColumn)
        queryBuilder.append(" AND feedback_tag.tag = ")
        queryBuilder.registerArgument(VarCharColumnType(), tag)
        queryBuilder.append(")")
    }
}

internal class HasTagLikeOp(
    private val feedbackIdColumn: Column<String>,
    private val pattern: String
) : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        queryBuilder.append("EXISTS (SELECT 1 FROM feedback_tag WHERE feedback_tag.feedback_id = ")
        queryBuilder.append(feedbackIdColumn)
        queryBuilder.append(" AND feedback_tag.tag LIKE ")
        queryBuilder.registerArgument(VarCharColumnType(), pattern)
        queryBuilder.append(")")
    }
}
