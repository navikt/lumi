package no.nav.lumi.service

import no.nav.lumi.domain.*
import no.nav.lumi.repository.DiscoveryStatsRepository
import no.nav.lumi.repository.TextThemeRepository
import no.nav.lumi.service.text.BigramAccumulator
import no.nav.lumi.service.text.QuoteSelector

/**
 * Service layer for Discovery analytics.
 * Contains business logic for processing discovery feedback into statistics.
 */
class DiscoveryService(
    private val discoveryRepository: DiscoveryStatsRepository = DiscoveryStatsRepository(),
    private val themeRepository: TextThemeRepository = TextThemeRepository()
) {
    companion object {
        
        /** Maximum examples per theme */
        const val MAX_EXAMPLES = 3
        
        /** Maximum recent responses to return */
        const val MAX_RECENT_RESPONSES = 20
        
        const val MAX_PHRASES = 30
        const val MIN_PHRASE_OCCURRENCES = 2
        
        const val MAX_PHRASE_SOURCE_RESPONSES = 3
    }

    /**
     * Get discovery statistics with theme-based grouping.
     */
    suspend fun getStats(query: StatsQuery): DiscoveryStatsResponse {
        val feedbacks = discoveryRepository.getDiscoveryFeedback(query)
        val themes = themeRepository.findByTeam(query.team, AnalysisContext.GENERAL_FEEDBACK)
        return processStats(feedbacks, themes)
    }

    /**
     * Process discovery feedback into statistics response.
     * This is internal but exposed for testing.
     */
    internal fun processStats(
        feedbacks: List<FeedbackDto>,
        themes: List<TextThemeDto>
    ): DiscoveryStatsResponse {
        val bigramAccumulators = mutableMapOf<String, BigramAccumulator>()
        val quoteCandidates = mutableListOf<Pair<String, String>>()
        val themeStats = themes.associate { it.name to ThemeAccumulator() }.toMutableMap()
        themeStats["Annet"] = ThemeAccumulator() // Catch-all for unmatched
        
        val recentResponses = mutableListOf<DiscoveryRecentResponse>()
        
        for (dto in feedbacks) {
            // Extract task text (first TEXT answer typically)
            val taskAnswer = SpecializedSurveyFieldIds.findTask(dto.surveyType, dto.answers)
            val taskText = when (val v = taskAnswer?.value) {
                is AnswerValue.Text -> v.text
                else -> continue
            }
            
            // Extract success status
            val successAnswer = SpecializedSurveyFieldIds.findSuccess(dto.answers)
            val successValue = when (val v = successAnswer?.value) {
                is AnswerValue.SingleChoice -> v.selectedOptionId
                else -> "unknown"
            }
            
            // Extract blocker if present
            val blockerAnswer = dto.answers.find { it.fieldId == SpecializedSurveyFieldIds.BLOCKER }
            val blockerText = when (val v = blockerAnswer?.value) {
                is AnswerValue.Text -> v.text
                else -> null
            }
            
            // Phrase extraction — adjacent content words with natural display text
            TextProcessor.extractBigrams(taskText).forEach { bg ->
                val acc = bigramAccumulators.getOrPut(bg.stemKey) { BigramAccumulator(bg.stemKey) }
                acc.addOccurrence(bg.surface, dto.id)
                bg.previousStemKey?.let { acc.addAdjacentWindow(it, dto.id) }
            }

            // Collect quote candidates
            quoteCandidates.add(taskText to dto.submittedAt)
            
            // A response can illuminate more than one theme. Only responses
            // without any configured match belong in the catch-all bucket.
            val matchedThemes = matchingThemeNames(taskText, themes).ifEmpty { listOf("Annet") }
            for (matchedTheme in matchedThemes) {
                val accumulator = themeStats.getValue(matchedTheme)
                accumulator.count++
                when (successValue) {
                    "yes" -> accumulator.successCount++
                    "partial" -> accumulator.partialCount++
                }
                if (accumulator.examples.size < MAX_EXAMPLES) {
                    accumulator.examples.add(taskText)
                }
            }
            
            // Recent responses
            if (recentResponses.size < MAX_RECENT_RESPONSES) {
                recentResponses.add(DiscoveryRecentResponse(
                    task = taskText,
                    success = successValue,
                    blocker = blockerText,
                    submittedAt = dto.submittedAt
                ))
            }
        }
        
        // Build phrase list from bigram accumulators
        val phrases = BigramAccumulator.selectDiverse(
            accumulators = bigramAccumulators.values,
            minimumOccurrences = MIN_PHRASE_OCCURRENCES,
            maximumPhrases = MAX_PHRASES,
        )
            .map { it.toPhraseEntry(maxSourceIds = MAX_PHRASE_SOURCE_RESPONSES) }

        // Select representative quotes (seed combines size + first ID for uniqueness per dataset)
        val quoteSeed = feedbacks.size.toLong() xor (feedbacks.firstOrNull()?.id?.hashCode()?.toLong() ?: 0L)
        val quotes = QuoteSelector.selectQuotes(quoteCandidates, seed = quoteSeed)
        val confidence = QuoteSelector.confidenceLevel(feedbacks.size)
        
        // Build theme results (exclude empty themes)
        val themeResults = themeStats
            .filter { it.value.count > 0 }
            .map { (name, acc) -> acc.toThemeResult(name) }
            .sortedByDescending { it.count }
        
        return DiscoveryStatsResponse(
            totalSubmissions = feedbacks.size,
            themes = themeResults,
            recentResponses = recentResponses,
            phrases = phrases,
            quotes = quotes,
            confidenceLevel = confidence,
        )
    }

    /**
     * Match text to a theme based on keywords.
     * Uses tokenize() (not extractWords()) so stopwords can still be theme keywords.
     * Returns every matching configured theme. Theme priority is retained in
     * storage for compatibility, but does not hide overlapping insights.
     */
    internal fun matchingThemeNames(text: String, themes: List<TextThemeDto>): List<String> {
        return themes.mapNotNull { theme ->
            if (TextProcessor.matchesThemeKeywords(text, theme.keywords)) {
                theme.name
            } else null
        }
    }
}

/**
 * Helper class to accumulate theme statistics during processing.
 */
internal data class ThemeAccumulator(
    var count: Int = 0,
    var successCount: Int = 0,
    var partialCount: Int = 0,
    val examples: MutableList<String> = mutableListOf()
) {
    /**
     * Calculate success rate: full success = 1.0, partial = 0.5
     */
    fun calculateSuccessRate(): Double {
        return if (count > 0) {
            (successCount.toDouble() + partialCount.toDouble() * 0.5) / count.toDouble()
        } else 0.0
    }

    fun toThemeResult(name: String): ThemeResult {
        return ThemeResult(name, count, calculateSuccessRate(), examples.toList())
    }
}
