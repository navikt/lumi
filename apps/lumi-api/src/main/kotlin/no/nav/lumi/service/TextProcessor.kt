package no.nav.lumi.service

import no.nav.lumi.service.text.NorwegianLightStemmer

/**
 * Utility for processing and stemming Norwegian text for analytics.
 * Consolidates text processing logic used across different services and repositories.
 */
object TextProcessor {

    /**
     * Norwegian stop words — union of backend and frontend lists, plus Nav-specific terms.
     * These are filtered out before word frequency / bigram analysis.
     */
    val STOP_WORDS = setOf(
        // --- Core Norwegian function words ---
        "og", "i", "jeg", "det", "at", "en", "et", "den", "til", "er", "som",
        "på", "de", "med", "han", "av", "ikke", "ikkje", "der", "så", "var", "meg",
        "seg", "men", "ett", "har", "om", "vi", "min", "mitt", "ha", "hadde",
        "hun", "nå", "over", "da", "ved", "fra", "du", "ut", "sin", "dem",
        "oss", "opp", "man", "kan", "hans", "hvor", "eller", "hva", "skal",
        "selv", "sjøl", "her", "alle", "vil", "bli", "ble", "blei", "blitt", "kunne",
        "inn", "når", "være", "kom", "noen", "noe", "ville", "dere", "deres",
        "kun", "ja", "etter", "ned", "skulle", "denne", "for", "deg", "to",
        "måtte", "få", "fikk", "fått", "gjøre", "gjort", "gjør",

        // --- Pronouns, determiners, conjunctions ---
        "si", "sine", "sitt", "mot", "å", "meget", "hvorfor", "dette", "disse",
        "uten", "hvordan", "ingen", "din", "ditt", "blir", "samme", "hvilken",
        "hvilke", "sånn", "inni", "mellom", "vår", "hver", "hvem", "vors",
        "hvis", "både", "bare", "fordi", "før", "mange", "også", "slik",
        "vært", "begge", "siden", "henne", "hennar", "hennes", "enten",
        "verken", "heller", "likevel", "altså", "derfor", "dersom", "imidlertid",

        // --- Common English stop words (surveys may contain English) ---
        "the", "and", "that", "this", "was", "were", "been", "have", "has", "had",
        "are", "is", "will", "would", "could", "should", "may", "might", "must",
        "shall", "can", "need", "you", "your", "yours", "they", "their", "theirs",
        "them", "she", "her", "hers", "him", "his", "its", "our", "ours",
        "who", "whom", "whose", "what", "which", "where", "when", "why", "how",
        "all", "each", "every", "both", "few", "more", "most", "other", "some",
        "such", "only", "own", "than", "too", "very", "just", "but", "because",
        "with", "about", "into", "through", "during", "before", "after", "above",
        "below", "between", "under", "again", "further", "then", "once", "here",
        "there", "any", "not",

        // --- Short / noise words (Norwegian) ---
        "litt", "veldig", "ganske", "helt", "går", "gå", "gikk", "gått",
        "ser", "sett", "tar", "tok", "tatt", "får",

        // --- Nav-specific noise ---
        "nav", "takk", "fjernet",
    )

    /**
     * Extract words from text, filtering stop words and short words.
     */
    fun extractWords(text: String): List<String> {
        return text.lowercase()
            .replace(Regex("[^a-zæøåA-ZÆØÅ0-9\\s]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length > 2 && it !in STOP_WORDS }
    }

    /**
     * Stem a Norwegian word using the Lucene NorwegianLightStemmer algorithm.
     * The stem is used for **grouping** — use [StemmedWord.surface] for display.
     */
    fun stemNorwegian(word: String): String {
        return NorwegianLightStemmer.stem(word.lowercase().trim())
    }

    /**
     * A word with its stemmed form.
     */
    data class StemmedWord(val surface: String, val stem: String)

    /**
     * Extract words from text with their stems.
     * @return List of (surfaceForm, stem) pairs
     */
    fun extractStemmedWords(text: String): List<StemmedWord> {
        return extractWords(text).map { word ->
            StemmedWord(surface = word, stem = stemNorwegian(word))
        }
    }
}
