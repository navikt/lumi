package no.nav.lumi.service

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import no.nav.lumi.config.exception.ApiErrorException
import no.nav.lumi.domain.*
import no.nav.lumi.integrations.valkey.StatsCache
import no.nav.lumi.integrations.valkey.ValkeyStatsCache
import no.nav.lumi.repository.FeedbackRepository
import no.nav.lumi.repository.FeedbackStatsRepository
import no.nav.lumi.repository.FieldTrendRepository
import no.nav.lumi.repository.SurveyDefinitionRepository
import no.nav.lumi.repository.TextThemeRepository
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.LocalDate
import java.time.temporal.ChronoUnit

private val json = Json { 
    ignoreUnknownKeys = true 
    encodeDefaults = true
}

/**
 * Service layer for feedback statistics.
 * Contains business logic for calculating and aggregating feedback statistics.
 * 
 * Uses StatsCache (Valkey with in-memory fallback) to cache expensive aggregations.
 * Default TTL: 3 minutes.
 */
class StatsService(
    private val feedbackRepository: FeedbackRepository = FeedbackRepository(),
    private val statsRepository: FeedbackStatsRepository = FeedbackStatsRepository(),
    private val fieldTrendRepository: FieldTrendRepository = FieldTrendRepository(),
    private val surveyDefinitionRepository: SurveyDefinitionRepository = SurveyDefinitionRepository(),
    private val themeRepository: TextThemeRepository = TextThemeRepository(),
    private val statsCache: StatsCache = ValkeyStatsCache.fromEnvOrFallback(),
    private val cacheTtl: Duration = Duration.ofMinutes(3)
) {
    private val overviewCacheTtl: Duration = Duration.ofMinutes(2)
    private val ratingsCacheTtl: Duration = Duration.ofMinutes(2)
    private val timelineCacheTtl: Duration = Duration.ofMinutes(2)
    private val topTasksCacheTtl: Duration = Duration.ofMinutes(3)
    private val surveyTypesCacheTtl: Duration = Duration.ofMinutes(5)
    private val blockersCacheTtl: Duration = Duration.ofMinutes(3)
    private val taskPriorityCacheTtl: Duration = Duration.ofMinutes(3)
    private val fieldTrendCacheTtl: Duration = Duration.ofMinutes(3)

    internal fun statsCacheKey(prefix: String, query: StatsQuery): String =
        "$prefix:${query.toCacheKey()}"

    internal fun fieldTrendCacheKey(
        query: StatsQuery,
        requestedFieldId: String?,
        granularity: FieldTrendGranularity,
    ): String {
        val selection = if (requestedFieldId == null) {
            "selection=default"
        } else {
            "selection=field&fieldId=${encodeCachePart(requestedFieldId)}"
        }
        return "${statsCacheKey("field-trend-v2", query)}&$selection&granularity=${granularity.postgresUnit}"
    }

    private fun StatsQuery.toCacheKey(): String {
        fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)

        val segmentValue = segments
            .takeIf { it.isNotEmpty() }
            ?.sortedBy { (k, v) -> "${k.trim()}:${v.trim()}" }
            ?.joinToString(",") { (k, v) -> "${k.trim()}:${v.trim()}" }

        val choiceValue = choiceFilters
            .takeIf { it.isNotEmpty() }
            ?.sortedBy { (k, v) -> "$k:$v" }
            ?.joinToString(",") { (k, v) -> "$k:$v" }

        val ratingValue = ratingFilters
            .takeIf { it.isNotEmpty() }
            ?.sortedBy { (k, v) -> "$k:$v" }
            ?.joinToString(",") { (k, v) -> "$k:$v" }

        val parts = listOf(
            "team" to team,
            "includeArchived" to includeArchived.toString(),
            "app" to app,
            "fromDate" to fromDate,
            "toDate" to toDate,
            "surveyId" to surveyId,
            "deviceType" to deviceType,
            "segment" to segmentValue,
            "task" to task,
            "choice" to choiceValue,
            "rating" to ratingValue,
            // Bump when the cached response semantics change. This prevents a
            // rolling deploy from serving values written by an older version.
            "resultVersion" to "3",
        )
            .filter { (_, value) -> value != null }
            .map { (key, value) -> "${enc(key)}=${enc(value!!)}" }

        return parts.joinToString("&")
    }

    private suspend inline fun <reified T> getOrComputeCached(
        prefix: String,
        query: StatsQuery,
        ttl: Duration,
        crossinline compute: suspend () -> T
    ): T = getOrComputeCached(statsCacheKey(prefix, query), ttl, compute)

    private suspend inline fun <reified T> getOrComputeCached(
        cacheKey: String,
        ttl: Duration,
        crossinline compute: suspend () -> T,
    ): T {
        statsCache.get(cacheKey)?.let { cached ->
            return try {
                json.decodeFromString<T>(cached)
            } catch (e: Exception) {
                compute().also { statsCache.set(cacheKey, json.encodeToString(it), ttl) }
            }
        }

        return compute().also { statsCache.set(cacheKey, json.encodeToString(it), ttl) }
    }

    /**
     * Get dashboard feedback statistics for the given query.
     * This is the primary stats endpoint used by lumi-dashboard.
     * Results are cached for 5 minutes.
     */
    suspend fun getDashboardStats(query: StatsQuery): FeedbackStats {
        val cacheKey = statsCacheKey("dashboard", query)
        
        // Try cache first
        statsCache.get(cacheKey)?.let { cached ->
            return try {
                json.decodeFromString<FeedbackStats>(cached)
            } catch (e: Exception) {
                computeStats(query).also { statsCache.set(cacheKey, json.encodeToString(it), cacheTtl) }
            }
        }
        
        // Compute and cache
        return computeStats(query).also { 
            statsCache.set(cacheKey, json.encodeToString(it), cacheTtl) 
        }
    }
    
    private suspend fun computeStats(query: StatsQuery): FeedbackStats {
        val stats = statsRepository.getStats(query)

        val analytics = if (!stats.masked) {
            statsRepository.getAnalyticsStats(query, includeFieldStats = query.surveyId != null)
        } else {
            null
        }

        val averageRating = calculateAverageRating(stats.byRating)
        val days = calculateDays(query.fromDate, query.toDate)
        
        // Build privacy info if data should be masked
        val privacy = if (stats.masked) {
            PrivacyInfo(
                masked = true,
                reason = "Antall svar (${stats.totalCount}) er under ${stats.threshold}. Statistikk vises ikke av hensyn til personvern.",
                threshold = stats.threshold
            )
        } else null
        
        return FeedbackStats(
            totalCount = stats.totalCount.toInt(),
            countWithText = stats.countWithText.toInt(),
            countWithoutText = (stats.totalCount - stats.countWithText).toInt(),
            byRating = if (stats.masked) emptyMap() else stats.byRating,
            byApp = if (stats.masked) emptyMap() else stats.byApp,
            byDate = if (stats.masked) emptyMap() else stats.byDate,
            bySurveyId = if (stats.masked) emptyMap() else stats.bySurveyId,
            averageRating = if (stats.masked) null else averageRating,
            period = StatsPeriod(
                fromDate = query.fromDate,
                toDate = query.toDate,
                days = days
            ),
            surveyType = stats.surveyType?.let {
                SurveyType.fromWireName(it) ?: SurveyType.CUSTOM
            },
            ratingByDate = if (stats.masked) emptyMap() else analytics?.ratingByDate.orEmpty(),
            byDevice = if (stats.masked) emptyMap() else analytics?.byDevice.orEmpty(),
            byScreenResolution = if (stats.masked) emptyMap() else analytics?.byScreenResolution.orEmpty(),
            byPathname = if (stats.masked) emptyMap() else analytics?.byPathname.orEmpty(),
            lowestRatingPaths = if (stats.masked) emptyMap() else analytics?.lowestRatingPaths.orEmpty(),
            fieldStats = if (stats.masked) emptyList() else analytics?.fieldStats.orEmpty(),
            privacy = privacy
        )
    }

    suspend fun getFieldTrend(
        query: StatsQuery,
        requestedFieldId: String?,
        granularity: FieldTrendGranularity,
    ): FieldTrendResponse {
        requireNotNull(query.surveyId) { "surveyId is required for field trend" }
        if (query.fromDate != null && query.toDate != null) {
            val from = LocalDate.parse(query.fromDate)
            val to = LocalDate.parse(query.toDate)
            val bucketCount = when (granularity) {
                FieldTrendGranularity.DAY -> ChronoUnit.DAYS.between(from, to) + 1
                FieldTrendGranularity.WEEK -> ChronoUnit.WEEKS.between(from, to) + 2
                FieldTrendGranularity.MONTH -> ChronoUnit.MONTHS.between(
                    from.withDayOfMonth(1),
                    to.withDayOfMonth(1),
                ) + 1
            }
            if (bucketCount > MAX_FIELD_TREND_POINTS) {
                throw ApiErrorException.BadRequestException(
                    "Field trend cannot exceed $MAX_FIELD_TREND_POINTS calendar buckets"
                )
            }
        }
        return getOrComputeCached(
            fieldTrendCacheKey(query, requestedFieldId, granularity),
            fieldTrendCacheTtl,
        ) {
            val storedDefinition = surveyDefinitionRepository
                .findByTeamAndSurveyId(query.team, query.surveyId)
                ?.definition
            val presentations = fieldTrendRepository.getFieldPresentations(query)
            val fields = buildFieldTrendFields(storedDefinition, presentations)
            val selectedField = fields.find { it.fieldId == requestedFieldId } ?: fields.firstOrNull()

            FieldTrendResponse(
                fields = fields,
                trend = selectedField?.let { field ->
                    fieldTrendRepository.getFieldTrend(
                        query = query,
                        fieldId = field.fieldId,
                        granularity = granularity,
                    )
                },
                privacyThreshold = FeedbackStatsRepository.MIN_AGGREGATION_THRESHOLD,
            )
        }
    }

    private fun buildFieldTrendFields(
        definition: SurveyDefinition?,
        presentations: List<FieldTrendRepository.FieldPresentation>,
    ): List<FieldTrendField> {
        val presentationById = presentations.associateBy { it.fieldId }
        val structuralFields = definition?.fields ?: presentations.map { it.toFieldDefinition() }

        return structuralFields.mapNotNull { field ->
            if (field.fieldType !in TREND_FIELD_TYPES) return@mapNotNull null
            val presentation = presentationById[field.fieldId]
            val ratingVariant = field.ratingVariant ?: presentation?.ratingVariant
            val ratingScale = field.ratingScale ?: presentation?.ratingScale
            if (field.fieldType == FieldType.RATING && ratingScale == null) return@mapNotNull null

            val optionLabels = presentation?.options.orEmpty().associateBy { it.id }
            val options = (field.optionIds ?: presentation?.options?.map { it.id }).orEmpty()
                .map { optionId -> optionLabels[optionId] ?: ChoiceOption(optionId, optionId) }
            val ratingMin = when {
                field.fieldType != FieldType.RATING -> null
                ratingVariant == RatingVariant.NPS -> 0
                else -> 1
            }
            val ratingMax = when {
                field.fieldType != FieldType.RATING -> null
                ratingVariant == RatingVariant.NPS -> ratingScale?.minus(1)
                else -> ratingScale
            }

            FieldTrendField(
                fieldId = field.fieldId,
                fieldType = field.fieldType,
                label = presentation?.label?.takeIf { it.isNotBlank() } ?: field.fieldId,
                options = options,
                ratingVariant = ratingVariant,
                ratingScale = ratingScale,
                ratingMin = ratingMin,
                ratingMax = ratingMax,
            )
        }
    }

    private fun encodeCachePart(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8)

    private fun FieldTrendRepository.FieldPresentation.toFieldDefinition(): FieldDefinition =
        FieldDefinition(
            fieldId = fieldId,
            fieldType = fieldType,
            ratingVariant = ratingVariant,
            ratingScale = ratingScale,
            optionIds = options.map { it.id }.takeIf { it.isNotEmpty() },
        )

    private companion object {
        val TREND_FIELD_TYPES = setOf(FieldType.RATING, FieldType.SINGLE_CHOICE, FieldType.MULTI_CHOICE)
        const val MAX_FIELD_TREND_POINTS = 2_000L
    }

    /**
     * Get stats overview (consolidated endpoint).
     */
    suspend fun getStatsOverview(query: StatsQuery): StatsOverviewResponse {
        return getOrComputeCached(prefix = "overview", query = query, ttl = overviewCacheTtl) {
            val stats = statsRepository.getStats(query)
            val range = if (query.fromDate != null || query.toDate != null) {
                DateRange(fromDate = query.fromDate, toDate = query.toDate)
            } else {
                null
            }

            if (stats.masked) {
                return@getOrComputeCached StatsOverviewResponse(
                    generatedAt = java.time.Instant.now().toString(),
                    range = range,
                    totals = StatsTotals(
                        feedbackCount = 0,
                        textCount = 0,
                        lowRatingCount = 0
                    ),
                    ratingDistribution = emptyMap()
                )
            }

            // Calculate low rating count (ratings 1-2)
            val lowRatingCount = stats.byRating
                .filter { (rating, _) -> rating.toIntOrNull()?.let { it <= 2 } ?: false }
                .values.sum()

            StatsOverviewResponse(
                generatedAt = java.time.Instant.now().toString(),
                range = range,
                totals = StatsTotals(
                    feedbackCount = stats.totalCount.toInt(),
                    textCount = stats.countWithText.toInt(),
                    lowRatingCount = lowRatingCount
                ),
                ratingDistribution = stats.byRating
            )
        }
    }

    /**
     * Get rating distribution for the given query.
     */
    suspend fun getRatingDistribution(query: StatsQuery): RatingDistribution {
        return getOrComputeCached(prefix = "ratings", query = query, ttl = ratingsCacheTtl) {
            val stats = statsRepository.getStats(query)

            if (stats.masked) {
                return@getOrComputeCached RatingDistribution(
                    distribution = emptyMap(),
                    average = null,
                    total = 0
                )
            }

            RatingDistribution(
                distribution = stats.byRating,
                average = calculateAverageRating(stats.byRating),
                total = stats.byRating.values.sum()
            )
        }
    }

    /**
     * Get timeline data for the given query.
     */
    suspend fun getTimeline(query: StatsQuery): TimelineResponse {
        return getOrComputeCached(prefix = "timeline", query = query, ttl = timelineCacheTtl) {
            val stats = statsRepository.getStats(query)

            if (stats.masked) {
                return@getOrComputeCached TimelineResponse(data = emptyList())
            }

            TimelineResponse(
                data = stats.byDate.map { (date, count) ->
                    TimelineEntry(date = date, count = count)
                }.sortedBy { it.date }
            )
        }
    }

    /**
     * Get Top Tasks statistics for the given query.
     */
    suspend fun getTopTasksStats(query: StatsQuery): TopTasksResponse {
        return getOrComputeCached(prefix = "topTasks", query = query, ttl = topTasksCacheTtl) {
            val stats = statsRepository.getStats(query)
            if (stats.masked) {
                return@getOrComputeCached TopTasksResponse(
                    totalSubmissions = 0,
                    tasks = emptyList(),
                    dailyStats = emptyMap(),
                    questionText = null
                )
            }

            statsRepository.getTopTasksStats(query)
        }
    }

    /**
     * Get Survey Type distribution for the given query.
     */
    suspend fun getSurveyTypeDistribution(query: StatsQuery): SurveyTypeDistribution {
        return getOrComputeCached(prefix = "surveyTypes", query = query, ttl = surveyTypesCacheTtl) {
            val stats = statsRepository.getStats(query)
            if (stats.masked) {
                return@getOrComputeCached SurveyTypeDistribution(
                    totalSurveys = 0,
                    distribution = emptyList()
                )
            }

            statsRepository.getSurveyTypeDistribution(query)
        }
    }

    /**
     * Get blocker text analysis for Top Tasks (phrases, themes, and recent blockers).
     * Uses themes where analysisContext = BLOCKER.
     */
    suspend fun getBlockerStats(query: StatsQuery): BlockerStatsResponse {
        return getOrComputeCached(prefix = "blockers", query = query, ttl = blockersCacheTtl) {
            val stats = statsRepository.getStats(query)
            if (stats.masked) {
                return@getOrComputeCached BlockerStatsResponse(
                    totalBlockers = 0,
                    themes = emptyList(),
                    recentBlockers = emptyList()
                )
            }

            val themes = themeRepository.findByTeam(query.team, AnalysisContext.BLOCKER)
            statsRepository.getBlockerStats(query, themes)
        }
    }

    /**
     * Get Task Priority statistics for the given query ("long neck" distribution).
     */
    suspend fun getTaskPriorityStats(query: StatsQuery): TaskPriorityResponse {
        return getOrComputeCached(prefix = "taskPriority", query = query, ttl = taskPriorityCacheTtl) {
            val stats = statsRepository.getStats(query)
            if (stats.masked) {
                return@getOrComputeCached TaskPriorityResponse(
                    totalSubmissions = 0,
                    tasks = emptyList(),
                    longNeckCutoff = 0,
                    cumulativePercentageAt5 = 0
                )
            }

            statsRepository.getTaskPriorityStats(query)
        }
    }

    /**
     * Calculate average rating from rating distribution.
     * Returns null if no numeric ratings found.
     */
    fun calculateAverageRating(byRating: Map<String, Int>): Double? {
        val numericRatings = byRating.mapNotNull { (rating, count) ->
            rating.toIntOrNull()?.let { it to count }
        }
        
        if (numericRatings.isEmpty()) return null
        
        val totalSum = numericRatings.map { it.first * it.second }.sum()
        val totalCount = numericRatings.sumOf { it.second }
        
        return if (totalCount > 0) totalSum.toDouble() / totalCount else null
    }

    /**
     * Calculate number of days in the query period.
     */
    fun calculateDays(from: String?, to: String?): Int {
        return try {
            val toDate = to?.let { LocalDate.parse(it.take(10)) } ?: LocalDate.now()
            // Interpret the period as inclusive of both fromDate and toDate.
            // Default period should be "last 30 days" including today.
            val fromDate = from?.let { LocalDate.parse(it.take(10)) } ?: toDate.minusDays(29)
            (ChronoUnit.DAYS.between(fromDate, toDate).toInt() + 1).coerceAtLeast(1)
        } catch (e: Exception) {
            30
        }
    }
}
