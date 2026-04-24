package no.nav.lumi.service.text

import no.nav.lumi.domain.ConfidenceLevel
import no.nav.lumi.domain.QuoteEntry
import kotlin.random.Random

/**
 * Selects representative quotes and computes confidence levels for text analysis.
 */
object QuoteSelector {

    private const val MIN_QUOTE_LENGTH = 30
    private const val MAX_QUOTE_LENGTH = 300
    private const val DEFAULT_TARGET_COUNT = 5

    /**
     * Select representative quotes from candidate texts.
     * Filters to quotes between [MIN_QUOTE_LENGTH] and [MAX_QUOTE_LENGTH] characters,
     * then shuffles with a deterministic seed for reproducibility within the same dataset.
     *
     * @param candidates List of (text, answeredAt) pairs
     * @param targetCount Maximum number of quotes to return (default 5)
     * @param seed Random seed for reproducible shuffling
     */
    fun selectQuotes(
        candidates: List<Pair<String, String>>,
        targetCount: Int = DEFAULT_TARGET_COUNT,
        seed: Long,
    ): List<QuoteEntry> {
        val eligible = candidates.filter { (text, _) ->
            text.length in MIN_QUOTE_LENGTH..MAX_QUOTE_LENGTH
        }
        if (eligible.isEmpty()) return emptyList()

        return eligible
            .shuffled(Random(seed))
            .take(targetCount)
            .map { (text, answeredAt) -> QuoteEntry(text = text, answeredAt = answeredAt) }
    }

    /**
     * Determine confidence level based on total response count.
     * - "low": fewer than 30 responses — bigrams are unreliable, prefer quotes
     * - "medium": 30–100 responses — bigrams are useful alongside quotes
     * - "high": more than 100 responses — bigrams provide strong signal
     */
    fun confidenceLevel(totalResponses: Int): ConfidenceLevel {
        return when {
            totalResponses < 30 -> ConfidenceLevel.LOW
            totalResponses <= 100 -> ConfidenceLevel.MEDIUM
            else -> ConfidenceLevel.HIGH
        }
    }
}
