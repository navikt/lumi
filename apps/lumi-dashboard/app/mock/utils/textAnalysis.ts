/**
 * Text analysis utilities for mock data.
 *
 * Provides Norwegian word stemming and theme keyword matching.
 * Single source of truth - previously duplicated in stats.ts and mockData.ts.
 */

// ============================================
// Norwegian Stop Words
// ============================================

/**
 * Common Norwegian stop words to filter out in text analysis.
 * Matches the backend DiscoveryService.STOP_WORDS.
 */
export const STOP_WORDS = new Set([
  "og",
  "i",
  "jeg",
  "det",
  "at",
  "en",
  "et",
  "den",
  "til",
  "er",
  "som",
  "på",
  "de",
  "med",
  "han",
  "av",
  "ikke",
  "ikkje",
  "der",
  "så",
  "var",
  "meg",
  "seg",
  "men",
  "ett",
  "har",
  "om",
  "vi",
  "min",
  "mitt",
  "ha",
  "hadde",
  "hun",
  "nå",
  "over",
  "da",
  "ved",
  "fra",
  "du",
  "ut",
  "sin",
  "dem",
  "oss",
  "opp",
  "man",
  "kan",
  "hans",
  "hvor",
  "eller",
  "hva",
  "skal",
  "selv",
  "sjøl",
  "her",
  "alle",
  "vil",
  "bli",
  "ble",
  "blei",
  "blitt",
  "kunne",
  "inn",
  "når",
  "være",
  "kom",
  "noen",
  "noe",
  "ville",
  "dere",
  "som",
  "deres",
  "kun",
  "ja",
  "etter",
  "ned",
  "skulle",
  "denne",
  "for",
  "deg",
  "si",
  "sine",
  "sitt",
  "mot",
  "å",
  "meget",
  "hvorfor",
  "dette",
  "disse",
  "uten",
  "hvordan",
  "ingen",
  "din",
  "ditt",
  "blir",
  "samme",
  "hvilken",
  "hvilke",
  "sånn",
  "inni",
  "mellom",
  "vår",
  "hver",
  "hvem",
  "vors",
  "hvis",
  "både",
  "bare",
  "fordi",
  "før",
  "mange",
  "også",
  "slik",
  "vært",
  "nå",
  "begge",
  "siden",
  "henne",
  "hennar",
  "hennes",
  // Additional common words
  "the",
  "and",
  "that",
  "this",
  "was",
  "were",
  "been",
  "have",
  "has",
  "had",
  "are",
  "is",
  "was",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "you",
  "your",
  "yours",
  "they",
  "their",
  "theirs",
  "them",
  "she",
  "her",
  "hers",
  "him",
  "his",
  "its",
  "our",
  "ours",
  "who",
  "whom",
  "whose",
  "what",
  "which",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "only",
  "own",
  "than",
  "too",
  "very",
  "just",
  "but",
  "because",
  "with",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "any",
  "not",
  // Short/noise words
  "litt",
  "veldig",
  "ganske",
  "helt",
  "bare",
  "fikk",
  "får",
  "fått",
  "gjør",
  "gjøre",
  "gjort",
  "går",
  "gå",
  "gikk",
  "gått",
  "ser",
  "sett",
  "tar",
  "tok",
  "tatt",
]);

// ============================================
// Norwegian Stemmer
// ============================================

/**
 * Simple Norwegian stemmer that removes common suffixes.
 * Handles definite articles, plurals, and verb forms.
 * Mirrors the backend implementation in DiscoveryService.kt.
 */
export function stemNorwegian(word: string): string {
  const stem = word.toLowerCase().trim();

  // Common Norwegian suffixes to remove (order matters - longer first)
  const suffixes = [
    // Noun definite/indefinite forms
    "ene",
    "ane", // plural definite
    "en",
    "et",
    "a", // singular definite
    "er",
    "ar", // plural indefinite

    // Verb forms
    "te",
    "de", // past tense
    "ere",
    "est", // comparative/superlative
  ];

  for (const suffix of suffixes) {
    // Only remove if stem would still be meaningful (3+ chars)
    if (stem.length > suffix.length + 2 && stem.endsWith(suffix)) {
      return stem.slice(0, -suffix.length);
    }
  }

  return stem;
}

// ============================================
// Theme Matching
// ============================================

/**
 * Check if feedback text matches any keyword from a theme.
 * Uses Norwegian stemming for better matching.
 */
export function matchesThemeKeywords(
  text: string,
  keywords: string[],
): boolean {
  const textWords = text
    .toLowerCase()
    .replace(/[^\wæøå\s]/g, "")
    .split(/\s+/)
    .map(stemNorwegian);

  const keywordStems = keywords.map((k) => stemNorwegian(k.toLowerCase()));

  return keywordStems.some((kStem) => textWords.includes(kStem));
}

/**
 * Extract words from text for frequency analysis.
 * Filters out stop words and short words.
 */
export function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zæøåA-ZÆØÅ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Get stemmed words from text for theme matching.
 */
export function extractStemmedWords(text: string): string[] {
  return extractWords(text).map(stemNorwegian);
}
