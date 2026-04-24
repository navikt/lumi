package no.nav.lumi.service

import no.nav.lumi.domain.*
import no.nav.lumi.repository.DiscoveryStatsRepository
import no.nav.lumi.repository.TextThemeRepository
import no.nav.lumi.service.text.BigramAccumulator
import no.nav.lumi.service.text.QuoteSelector
import no.nav.lumi.service.text.StemWordAccumulator

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
        
        /** Maximum words in frequency list */
        const val MAX_WORD_FREQUENCY = 50

        const val MAX_PHRASES = 30
        const val MIN_PHRASE_OCCURRENCES = 2
        
        /** Maximum source responses per word in discovery */
        const val MAX_SOURCE_RESPONSES_DISCOVERY = 3
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
        // Stem-based word frequency accumulator
        val wordAccumulators = mutableMapOf<String, StemWordAccumulator>()
        val bigramAccumulators = mutableMapOf<String, BigramAccumulator>()
        val quoteCandidates = mutableListOf<Pair<String, String>>()
        val themeStats = themes.associate { it.name to ThemeAccumulator() }.toMutableMap()
        themeStats["Annet"] = ThemeAccumulator() // Catch-all for unmatched
        
        val recentResponses = mutableListOf<DiscoveryRecentResponse>()
        
        for (dto in feedbacks) {
            // Extract task text (first TEXT answer typically)
            val taskAnswer = dto.answers.find { it.fieldId == "task" }
            val taskText = when (val v = taskAnswer?.value) {
                is AnswerValue.Text -> v.text
                else -> continue
            }
            
            // Extract success status
            val successAnswer = dto.answers.find { it.fieldId == "success" }
            val successValue = when (val v = successAnswer?.value) {
                is AnswerValue.SingleChoice -> v.selectedOptionId
                else -> "unknown"
            }
            
            // Extract blocker if present
            val blockerAnswer = dto.answers.find { it.fieldId == "blocker" }
            val blockerText = when (val v = blockerAnswer?.value) {
                is AnswerValue.Text -> v.text
                else -> null
            }
            
            // Word frequency analysis with stem grouping
            val seenStemsInResponse = mutableSetOf<String>()
            TextProcessor.extractStemmedWords(taskText).forEach { (surface, stem) ->
                val acc = wordAccumulators.getOrPut(stem) { StemWordAccumulator(stem) }
                acc.addOccurrence(surface)
                
                // Add source response (max 3 per stem, deduped by text, max 1 per response per stem)
                if (!seenStemsInResponse.contains(stem) && acc.sourceResponses.size < MAX_SOURCE_RESPONSES_DISCOVERY) {
                    val sourceText = taskText
                    if (!acc.usedTexts.contains(sourceText)) {
                        acc.sourceResponses.add(SourceResponse(text = sourceText, submittedAt = dto.submittedAt))
                        acc.usedTexts.add(sourceText)
                    }
                    seenStemsInResponse.add(stem)
                }
            }

            // Bigram extraction — pairs of adjacent content words
            TextProcessor.extractBigrams(taskText).forEach { bg ->
                val acc = bigramAccumulators.getOrPut(bg.stemKey) { BigramAccumulator(bg.stemKey) }
                acc.addOccurrence(bg.surface, dto.id)
            }

            // Collect quote candidates
            quoteCandidates.add(taskText to dto.submittedAt)
            
            // Theme matching (find first matching theme based on priority)
            val matchedTheme = matchTheme(taskText, themes)
            val accumulator = themeStats[matchedTheme]!!
            accumulator.count++
            when (successValue) {
                "yes" -> accumulator.successCount++
                "partial" -> accumulator.partialCount++
            }
            if (accumulator.examples.size < MAX_EXAMPLES) {
                accumulator.examples.add(taskText)
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
        
        // Build word frequency list from accumulators
        val wordFrequency = wordAccumulators.values
            .sortedByDescending { it.totalCount }
            .take(MAX_WORD_FREQUENCY)
            .map { it.toWordFrequencyEntry() }

        // Build phrase list from bigram accumulators
        val phrases = bigramAccumulators.values
            .filter { it.totalCount >= MIN_PHRASE_OCCURRENCES }
            .sortedByDescending { it.totalCount }
            .take(MAX_PHRASES)
            .map { it.toPhraseEntry(maxSourceIds = MAX_SOURCE_RESPONSES_DISCOVERY) }

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
            wordFrequency = wordFrequency,
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
     * Returns the name of the first matching theme (by priority) or "Annet".
     */
    internal fun matchTheme(text: String, themes: List<TextThemeDto>): String {
        val textWords = TextProcessor.tokenize(text).map { TextProcessor.stemNorwegian(it) }.toSet()
        
        for (theme in themes.sortedByDescending { it.priority }) {
            val keywordStems = theme.keywords.map { TextProcessor.stemNorwegian(it.lowercase()) }.toSet()
            if (textWords.any { it in keywordStems }) {
                return theme.name
            }
        }
        return "Annet"
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
