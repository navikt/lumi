package no.nav.lumi.service.text

import no.nav.lumi.domain.PhraseEntry

/**
 * Accumulates content-word pair frequency statistics grouped by stem key.
 * Tracks surface form counts to determine canonical (most common) display form,
 * and enforces per-response deduplication (one response contributes at most 1 count).
 *
 * @property stemKey Compound key "stem1|stem2" for grouping
 */
class BigramAccumulator(val stemKey: String) {
    private val surfaceCounts = mutableMapOf<String, Int>()
    private val seenResponseIds = mutableSetOf<String>()
    private val _sourceResponseIds = mutableListOf<String>()
    private val adjacentResponseIds = mutableMapOf<String, MutableSet<String>>()

    /** Total unique responses containing this content-word pair */
    val totalCount: Int get() = seenResponseIds.size

    /** All response ids are retained internally so phrase selection can avoid duplicates. */
    internal val sourceResponseIds: Set<String> get() = seenResponseIds

    /**
     * Record an occurrence of this phrase from a specific response.
     * Each response contributes at most 1 count regardless of how many times
     * the phrase appears in that response.
     */
    fun addOccurrence(surface: String, responseId: String) {
        if (responseId in seenResponseIds) return
        seenResponseIds.add(responseId)
        surfaceCounts[surface] = (surfaceCounts[surface] ?: 0) + 1
        if (_sourceResponseIds.size < DEFAULT_MAX_SOURCE_IDS) {
            _sourceResponseIds.add(responseId)
        }
    }

    fun addAdjacentWindow(otherStemKey: String, responseId: String) {
        adjacentResponseIds.getOrPut(otherStemKey) { mutableSetOf() }.add(responseId)
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

        /**
         * Pick frequent phrases without letting several windows from the same
         * responses fill the list. Candidates are grouped only when they form a
         * connected word chain and share at least 80 percent of the smaller
         * response set, so unrelated findings from the same cohort remain visible.
         */
        fun selectDiverse(
            accumulators: Collection<BigramAccumulator>,
            minimumOccurrences: Int,
            maximumPhrases: Int,
        ): List<BigramAccumulator> {
            val candidates = accumulators
                .filter { it.totalCount >= minimumOccurrences }
                .sortedWith(compareByDescending<BigramAccumulator> { it.totalCount }.thenBy { it.stemKey })
            val selected = mutableListOf<BigramAccumulator>()
            val grouped = mutableSetOf<BigramAccumulator>()

            for (candidate in candidates) {
                if (candidate in grouped) continue
                selected.add(candidate)
                grouped.add(candidate)

                val queue = ArrayDeque<BigramAccumulator>()
                queue.add(candidate)
                while (queue.isNotEmpty()) {
                    val current = queue.removeFirst()
                    for (other in candidates) {
                        if (other in grouped || !current.isRelatedWindow(other)) continue
                        grouped.add(other)
                        queue.add(other)
                    }
                }
                if (selected.size == maximumPhrases) break
            }
            return selected
        }

        private fun BigramAccumulator.isRelatedWindow(other: BigramAccumulator): Boolean {
            val smallerSize = minOf(sourceResponseIds.size, other.sourceResponseIds.size)
            if (smallerSize == 0) return false
            val observedTogether = adjacentResponseIds[other.stemKey].orEmpty() +
                other.adjacentResponseIds[stemKey].orEmpty()
            return observedTogether.size.toDouble() / smallerSize >= 0.8
        }
    }
}
