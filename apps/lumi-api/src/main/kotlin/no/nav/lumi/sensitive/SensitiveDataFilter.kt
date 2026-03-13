package no.nav.lumi.sensitive

import org.slf4j.LoggerFactory

/**
 * Service for detecting and redacting sensitive data from text.
 */
class SensitiveDataFilter(
    private val patterns: List<SensitivePattern> = SensitiveDataPatterns.HIGH_CONFIDENCE_PATTERNS,
    private val logMatches: Boolean = true
) {
    private val log = LoggerFactory.getLogger(SensitiveDataFilter::class.java)
    
    /**
     * Detect sensitive data in text without modifying it.
     * Returns list of matches found.
     */
    fun detect(text: String?): List<SensitiveDataMatch> {
        if (text.isNullOrBlank()) return emptyList()
        
        val matches = mutableListOf<SensitiveDataMatch>()
        
        for (pattern in patterns) {
            pattern.pattern.findAll(text).forEach { matchResult ->
                if (pattern.validator == null || pattern.validator(matchResult.value)) {
                    matches.add(
                        SensitiveDataMatch(
                            patternName = pattern.name,
                            matchedValue = matchResult.value,
                            startIndex = matchResult.range.first,
                            endIndex = matchResult.range.last + 1
                        )
                    )
                }
            }
        }
        
        return matches.sortedBy { it.startIndex }
    }
    
    /**
     * Redact sensitive data from text.
     * Returns the redacted text and information about what was redacted.
     */
    fun redact(text: String?): RedactionResult {
        if (text.isNullOrBlank()) {
            return RedactionResult(
                originalText = text ?: "",
                redactedText = text ?: "",
                matches = emptyList(),
                wasRedacted = false
            )
        }
        
        val allMatches = detect(text)
        val appliedMatches = selectNonOverlappingMatches(allMatches)
        
        if (allMatches.isEmpty()) {
            return RedactionResult(
                originalText = text,
                redactedText = text,
                matches = emptyList(),
                wasRedacted = false
            )
        }
        
        var redactedText: String = text
        
        // Apply replacements in reverse order to preserve indices
        val sortedMatches = appliedMatches.sortedByDescending { it.startIndex }
        
        for (match in sortedMatches) {
            val pattern = patterns.find { it.name == match.patternName }
            val replacement = pattern?.replacement ?: "[SENSITIVT DATA FJERNET]"
            
            redactedText = redactedText.replaceRange(
                match.startIndex,
                match.endIndex,
                replacement
            )
        }
        
        if (logMatches) {
            val patternCounts = allMatches.groupBy { it.patternName }.mapValues { it.value.size }
            log.info("Redacted sensitive data: $patternCounts")
        }
        
        return RedactionResult(
            originalText = text,
            redactedText = redactedText,
            matches = allMatches,
            wasRedacted = true
        )
    }
    
    /**
     * Check if text contains any sensitive data.
     */
    fun containsSensitiveData(text: String?): Boolean {
        return detect(text).isNotEmpty()
    }
    
    /**
     * Redact sensitive data from a map of values (like feedback JSON).
     * Only processes string values.
     */
    fun redactMap(data: Map<String, Any?>): Pair<Map<String, Any?>, List<SensitiveDataMatch>> {
        val allMatches = mutableListOf<SensitiveDataMatch>()
        
        val redactedData = data.mapValues { (key, value) ->
            when (value) {
                is String -> {
                    val result = redact(value)
                    allMatches.addAll(result.matches.map { 
                        it.copy(patternName = "$key.${it.patternName}") 
                    })
                    result.redactedText
                }
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    val nestedMap = value as Map<String, Any?>
                    val (redacted, matches) = redactMap(nestedMap)
                    allMatches.addAll(matches)
                    redacted
                }
                else -> value
            }
        }
        
        return redactedData to allMatches
    }
    
    companion object {
        /**
         * Default instance with high-confidence patterns only.
         * Use this for production to minimize false positives.
         */
        val DEFAULT = SensitiveDataFilter(
            patterns = SensitiveDataPatterns.HIGH_CONFIDENCE_PATTERNS
        )
        
        /**
         * Strict instance with all patterns including lower-confidence ones.
         * Use this when maximum protection is needed, accepting more false positives.
         */
        val STRICT = SensitiveDataFilter(
            patterns = SensitiveDataPatterns.ALL_PATTERNS
        )
    }

    /**
     * Reduce overlapping matches to a non-overlapping set.
     *
     * Some patterns intentionally overlap (e.g. 11 digits can be both fødselsnummer and kontonummer).
     * If we apply both, the second replacement would use indices from the original string and can corrupt
     * the output (e.g. "[KONTONUMMER FJERNET]MER FJERNET]").
     *
     * Strategy: prefer patterns earlier in [patterns] (higher confidence/priority).
     */
    private fun selectNonOverlappingMatches(allMatches: List<SensitiveDataMatch>): List<SensitiveDataMatch> {
        if (allMatches.isEmpty()) return emptyList()

        val priorityByName = patterns.mapIndexed { index, pattern -> pattern.name to index }.toMap()

        fun priority(match: SensitiveDataMatch): Int = priorityByName[match.patternName] ?: Int.MAX_VALUE

        // Sort by start, then by priority (lower is better), then by length (longer first).
        val sorted = allMatches.sortedWith(
            compareBy<SensitiveDataMatch> { it.startIndex }
                .thenBy { priority(it) }
                .thenByDescending { it.endIndex - it.startIndex }
        )

        val accepted = mutableListOf<SensitiveDataMatch>()

        for (match in sorted) {
            // Pop and replace any overlapping lower-priority matches.
            while (accepted.isNotEmpty()) {
                val last = accepted.last()
                val overlaps = match.startIndex < last.endIndex && match.endIndex > last.startIndex
                if (!overlaps) break

                val keepNew = priority(match) < priority(last)
                if (keepNew) {
                    accepted.removeAt(accepted.lastIndex)
                    continue
                }

                // Existing match has higher or equal priority → drop the new one.
                break
            }

            val overlapsAny = accepted.any {
                match.startIndex < it.endIndex && match.endIndex > it.startIndex
            }
            if (!overlapsAny) {
                accepted.add(match)
            }
        }

        return accepted.sortedBy { it.startIndex }
    }
}
