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
        val spans = mergeOverlappingMatches(allMatches)
        
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
        val sortedSpans = spans.sortedByDescending { it.startIndex }
        
        for (span in sortedSpans) {
            redactedText = redactedText.replaceRange(
                span.startIndex,
                span.endIndex,
                span.replacement
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

    private data class RedactionSpan(val startIndex: Int, val endIndex: Int, val replacement: String)

    /**
     * Merge overlapping matches into non-overlapping spans to replace.
     *
     * Some patterns overlap: 11 digits can be both fødselsnummer and kontonummer, and a card number with
     * spaces contains eight digits that also match the phone pattern. Applying both replacements would
     * corrupt the output (e.g. "[KONTONUMMER FJERNET]MER FJERNET]"), and keeping only one of the matches
     * would leave the rest of the other in the text (e.g. "[TELEFON FJERNET] 1111 1111" for a card number).
     *
     * Strategy: overlapping matches become one span covering all of them, so everything a pattern matched
     * is removed. The span gets the replacement of the longest match. On equal length, the pattern earlier
     * in [patterns] wins (fødselsnummer before kontonummer).
     */
    private fun mergeOverlappingMatches(allMatches: List<SensitiveDataMatch>): List<RedactionSpan> {
        val priorityByName = patterns.mapIndexed { index, pattern -> pattern.name to index }.toMap()
        val replacementByName = patterns.associate { it.name to it.replacement }

        val longestFirst = compareByDescending<SensitiveDataMatch> { it.endIndex - it.startIndex }
            .thenBy { priorityByName[it.patternName] ?: Int.MAX_VALUE }

        val groups = mutableListOf<MutableList<SensitiveDataMatch>>()
        var groupEnd = 0

        for (match in allMatches.sortedBy { it.startIndex }) {
            if (groups.isEmpty() || match.startIndex >= groupEnd) {
                groups.add(mutableListOf())
            }
            groups.last().add(match)
            groupEnd = maxOf(groupEnd, match.endIndex)
        }

        return groups.map { group ->
            val winner = group.minWith(longestFirst)
            RedactionSpan(
                startIndex = group.first().startIndex,
                endIndex = group.maxOf { it.endIndex },
                replacement = replacementByName[winner.patternName] ?: "[SENSITIVT DATA FJERNET]",
            )
        }
    }
}
