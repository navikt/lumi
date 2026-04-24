package no.nav.lumi.service

import no.nav.lumi.service.text.NorwegianLightStemmer

/**
 * Utility for processing and stemming Norwegian text for analytics.
 * Consolidates text processing logic used across different services and repositories.
 */
object TextProcessor {
    // Matches all redaction markers: [FØDSELSNUMMER FJERNET], [HEMMELIG ADRESSE], etc.
    private val redactionMarkerRegex = Regex("\\[[A-ZÆØÅ][A-ZÆØÅ\\s-]+]")
    private val tokenCleanupRegex = Regex("[^a-zæøåA-ZÆØÅ0-9\\s]")
    private val whitespaceRegex = Regex("\\s+")

    /**
     * Norwegian stop words — data-driven from analysis of 1 283 production survey responses.
     * Covers bokmål and nynorsk function words. No English (< 1% of text, not useful).
     * These are filtered out before word frequency / bigram analysis.
     */
    val STOP_WORDS = setOf(
        // --- Core bokmål function words ---
        "og", "i", "jeg", "det", "at", "en", "et", "den", "til", "er", "som",
        "på", "de", "med", "han", "av", "ikke", "der", "så", "var", "meg",
        "seg", "men", "ett", "har", "om", "vi", "min", "mitt", "ha", "hadde",
        "hun", "nå", "over", "da", "ved", "fra", "du", "ut", "sin", "dem",
        "oss", "opp", "man", "kan", "hans", "hvor", "eller", "hva", "skal",
        "selv", "sjøl", "her", "alle", "vil", "bli", "ble", "blei", "blitt",
        "inn", "når", "være", "kom", "noen", "noe", "ville", "dere", "deres",
        "kun", "ja", "etter", "ned", "denne", "for", "deg", "to",

        // --- Modal / auxiliary verbs ---
        "kunne", "skulle", "måtte", "må", "bør", "burde",
        "få", "fikk", "fått", "får",
        "gjøre", "gjort", "gjør",

        // --- Pronouns, determiners, conjunctions ---
        "si", "sine", "sitt", "mot", "å", "meget", "hvorfor", "dette", "disse",
        "uten", "hvordan", "ingen", "din", "ditt", "blir", "samme", "hvilken",
        "hvilke", "sånn", "inni", "mellom", "vår", "hver", "hvem",
        "hvis", "både", "bare", "fordi", "før", "mange", "også", "slik",
        "vært", "begge", "siden", "henne", "hennar", "hennes", "enten",
        "verken", "heller", "likevel", "altså", "derfor", "dersom", "imidlertid",

        // --- Quantifiers, degree adverbs, modal particles ---
        "mer", "mye", "lite", "flere", "alt", "andre", "enn", "nok",
        "litt", "veldig", "ganske", "helt", "svært",
        "kanskje", "alltid", "aldri", "ofte", "gjerne", "igjen",
        "jo", "vel",

        // --- Common opinion / perception verbs (no content value) ---
        "synes", "tror", "tenker", "vet", "vite", "mener",
        "opplever", "føler", "føles",
        "kommer", "komme",

        // --- Short / noise verb forms ---
        "går", "gå", "gikk", "gått",
        "ser", "sett", "tar", "tok", "tatt",

        // --- Nynorsk function words ---
        "ikkje", "meir", "mykje", "nokon", "noko", "deira",
        "korleis", "kvifor", "heilt", "sjølv", "eigen", "kvar", "kven",

        // --- Nav-specific noise ---
        "nav", "takk", "fjernet",
    )

    /**
     * Extract words from text, filtering stop words and short words.
     * Used for frequency analysis / word clouds where noise should be removed.
     */
    fun extractWords(text: String): List<String> {
        return tokenize(text).filter { it !in STOP_WORDS }
    }

    /**
     * Tokenize text into lowercase words (length > 2), without stopword filtering.
     * Used for theme matching where any word — including stopwords — may be a keyword.
     */
    fun tokenize(text: String): List<String> {
        return rawTokens(text).filter { it.length > 2 }
    }

    private fun rawTokens(text: String): List<String> {
        return text.replace(redactionMarkerRegex, " ")
            .lowercase()
            .replace(tokenCleanupRegex, " ")
            .split(whitespaceRegex)
            .filter { it.isNotBlank() }
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
     * A bigram (two-word phrase) with its stemmed key for grouping.
     */
    data class StemmedBigram(
        val surface: String,
        val stemKey: String,
    )

    /**
     * Extract words from text with their stems.
     * @return List of (surfaceForm, stem) pairs
     */
    fun extractStemmedWords(text: String): List<StemmedWord> {
        return extractWords(text).map { word ->
            StemmedWord(surface = word, stem = stemNorwegian(word))
        }
    }

    /**
     * Extract content-word bigrams from text.
     * Stopwords are filtered first, then adjacent content words are paired.
     * This means stopwords between content words are skipped:
     * "vanskelig å svare" → ["vanskelig", "svare"] → bigram "vanskelig svare"
     */
    fun extractBigrams(text: String): List<StemmedBigram> {
        val contentWords = extractWords(text)
        if (contentWords.size < 2) return emptyList()

        return contentWords.zipWithNext().map { (w1, w2) ->
            StemmedBigram(
                surface = "$w1 $w2",
                stemKey = "${stemNorwegian(w1)}|${stemNorwegian(w2)}",
            )
        }
    }
}
