package no.nav.lumi.repository

import no.nav.lumi.domain.BlockerThemeResult
import no.nav.lumi.domain.SourceResponse
import no.nav.lumi.domain.WordFrequencyEntry
import no.nav.lumi.domain.WordVariant

/**
 * Helper class to accumulate word frequency statistics grouped by stem.
 * Tracks surface form counts to determine canonical (most common) form.
 */
internal class BlockerStemWordAccumulator(val stem: String) {
    private val surfaceCounts = mutableMapOf<String, Int>()
    val sourceResponses = mutableListOf<SourceResponse>()
    val usedTexts = mutableSetOf<String>() // Dedup sourceResponses by text

    /** Total occurrences across all surface forms */
    val totalCount: Int get() = surfaceCounts.values.sum()

    /** Add an occurrence of a surface form */
    fun addOccurrence(surface: String) {
        surfaceCounts[surface] = (surfaceCounts[surface] ?: 0) + 1
    }

    /** Get canonical form (most common surface form) */
    fun getCanonicalForm(): String {
        return surfaceCounts.entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .firstOrNull()?.key ?: stem
    }

    /** Get top variants sorted by count desc */
    fun getVariants(): List<WordVariant> {
        return surfaceCounts.entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(FeedbackStatsRepository.MAX_VARIANTS)
            .map { WordVariant(word = it.key, count = it.value) }
    }

    /** Convert to WordFrequencyEntry */
    fun toWordFrequencyEntry(): WordFrequencyEntry {
        return WordFrequencyEntry(
            word = getCanonicalForm(),
            stem = stem,
            count = totalCount,
            variants = getVariants(),
            sourceResponses = sourceResponses.toList()
        )
    }
}

internal class ThemeAccumulator(
    val theme: String,
    val themeId: String,
    val color: String?,
    val examples: MutableList<String> = mutableListOf(),
    val usedExamples: MutableSet<String> = mutableSetOf(),
    var count: Int = 0,
) {
    fun toResult(): BlockerThemeResult {
        return BlockerThemeResult(
            theme = theme,
            themeId = themeId,
            count = count,
            examples = examples.toList(),
            color = color,
        )
    }
}
