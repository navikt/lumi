package no.nav.lumi.service.text

import no.nav.lumi.domain.PhraseEntry

/**
 * Accumulates bigram (two-word phrase) frequency statistics grouped by stem key.
 * Tracks surface form counts to determine canonical (most common) display form,
 * and enforces per-response deduplication (one response contributes at most 1 count).
 *
 * @property stemKey Compound key "stem1|stem2" for grouping
 */
class BigramAccumulator(val stemKey: String) {
    private val surfaceCounts = mutableMapOf<String, Int>()
    private val seenResponseIds = mutableSetOf<String>()
    private val _sourceResponseIds = mutableListOf<String>()

    /** Total unique responses containing this bigram */
    val totalCount: Int get() = seenResponseIds.size

    /**
     * Record an occurrence of this bigram from a specific response.
     * Each response contributes at most 1 count regardless of how many times
     * the bigram appears in that response.
     */
    fun addOccurrence(surface: String, responseId: String) {
        if (responseId in seenResponseIds) return
        seenResponseIds.add(responseId)
        surfaceCounts[surface] = (surfaceCounts[surface] ?: 0) + 1
        if (_sourceResponseIds.size < DEFAULT_MAX_SOURCE_IDS) {
            _sourceResponseIds.add(responseId)
        }
    }

    /** Get canonical surface form (most common, tiebreaker alphabetical) */
    fun getCanonicalSurface(): String {
        return surfaceCounts.entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .firstOrNull()?.key ?: stemKey
    }

    /** Convert to PhraseEntry for API response */
    fun toPhraseEntry(maxSourceIds: Int = DEFAULT_MAX_SOURCE_IDS): PhraseEntry {
        return PhraseEntry(
            text = getCanonicalSurface(),
            count = totalCount,
            sourceResponseIds = _sourceResponseIds.take(maxSourceIds)
        )
    }

    companion object {
        const val DEFAULT_MAX_SOURCE_IDS = 5
    }
}
