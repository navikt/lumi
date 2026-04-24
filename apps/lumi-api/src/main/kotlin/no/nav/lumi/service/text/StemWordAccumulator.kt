package no.nav.lumi.service.text

import no.nav.lumi.domain.SourceResponse
import no.nav.lumi.domain.WordFrequencyEntry
import no.nav.lumi.domain.WordVariant

/**
 * Accumulates word frequency statistics grouped by stem.
 * Tracks surface form counts to determine canonical (most common) form,
 * and collects source responses for context.
 *
 * Used by both Discovery and Blocker analysis pipelines.
 *
 * @property stem The normalized/stemmed form used as grouping key
 * @property maxVariants Maximum number of word variants to include in output (default 5)
 */
class StemWordAccumulator(
    val stem: String,
    private val maxVariants: Int = DEFAULT_MAX_VARIANTS,
) {
    private val surfaceCounts = mutableMapOf<String, Int>()
    val sourceResponses = mutableListOf<SourceResponse>()
    val usedTexts = mutableSetOf<String>()

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
            .take(maxVariants)
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

    companion object {
        const val DEFAULT_MAX_VARIANTS = 5
    }
}
