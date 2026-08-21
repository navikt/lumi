package no.nav.lumi.service.text

/**
 * Groups surface forms by stem for the keyword summary on ordinary text fields.
 */
class StemWordAccumulator(val stem: String) {
    private val surfaceCounts = mutableMapOf<String, Int>()

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

}
