/**
 * Word analysis utilities for extracting insights from free-text survey responses.
 */

/**
 * Words that are filtered out from keyword analysis because they don't
 * provide meaningful insights. Includes common Norwegian function words,
 * pronouns, conjunctions, and frequently occurring generic words.
 */
export const IGNORED_WORDS = new Set([
  // ---------------------------------------------------------
  // Norwegian function words (prepositions, conjunctions, etc.)
  // ---------------------------------------------------------
  "og",
  "i",
  "er",
  "som",
  "en",
  "av",
  "til",
  "på",
  "for",
  "med",
  "at",
  "var",
  "de",
  "ikke",
  "den",
  "om",
  "et",
  "men",
  "så",
  "fra",
  "eller",
  "også",
  "bare",
  "hvis",
  "etter",
  "over",
  "under",
  "ved",
  "mot",
  "uten",
  "mellom",
  "blant",
  "gjennom",
  "langs",

  // ---------------------------------------------------------
  // Pronouns
  // ---------------------------------------------------------
  "jeg",
  "du",
  "han",
  "hun",
  "det",
  "vi",
  "dere",
  "de",
  "seg",
  "oss",
  "meg",
  "deg",
  "min",
  "mitt",
  "mine",
  "din",
  "ditt",
  "dine",
  "sin",
  "sitt",
  "sine",
  "hans",
  "hennes",
  "vår",
  "vårt",
  "våre",
  "deres",

  // ---------------------------------------------------------
  // Demonstratives & Quantifiers
  // ---------------------------------------------------------
  "denne",
  "dette",
  "disse",
  "den",
  "det",
  "de",
  "noe",
  "noen",
  "alle",
  "hver",
  "andre",
  "annen",
  "annet",
  "samme",
  "selv",
  "slik",
  "sånn",
  "hele",
  "mange",
  "mye",
  "lite",
  "litt",
  "nok",
  "mer",
  "flere",
  "mest",
  "flest",

  // ---------------------------------------------------------
  // Common verbs (auxiliary, modal, be/have)
  // ---------------------------------------------------------
  "har",
  "hadde",
  "være",
  "vært",
  "er",
  "var",
  "blir",
  "ble",
  "blitt",
  "kan",
  "kunne",
  "vil",
  "ville",
  "skal",
  "skulle",
  "må",
  "måtte",
  "bør",
  "burde",
  "får",
  "fikk",
  "fått",
  "gjør",
  "gjøre",
  "gjorde",
  "gjort",
  "går",
  "gå",
  "gikk",
  "gått",
  "kom",
  "komme",
  "kommer",
  "tror",
  "synes",
  "ser",
  "sier",
  "vet",

  // ---------------------------------------------------------
  // Question words & adverbs
  // ---------------------------------------------------------
  "hva",
  "hvem",
  "hvor",
  "når",
  "hvordan",
  "hvorfor",
  "her",
  "der",
  "opp",
  "ut",
  "inn",
  "ned",
  "nå",
  "alltid",
  "aldri",
  "ofte",
  "helt",
  "veldig",
  "ganske",
  "egentlig",
  "faktisk",

  // ---------------------------------------------------------
  // Generic/common words that don't add insight
  // ---------------------------------------------------------
  "nav",
  "hei",
  "takk",
  "bare",
  "litt",
  "bra",
  "fint",
  "greit",
  "ting",
  "noe",
  "gang",
  "ganger",
  "dag",
  "dager",
  "tid",
  "siden",

  // ---------------------------------------------------------
  // Redaction artifacts (from [fjernet] markers)
  // ---------------------------------------------------------
  "fjernet",
  "fjernet]",
  "[fjernet",
  "[fjernet]",
  "sladdet",
  "sensurert",
]);

export interface KeywordCount {
  word: string;
  count: number;
}

/**
 * Extract top keywords from an array of text responses.
 * Filters out Norwegian stop words and short words.
 *
 * @param texts - Array of text responses to analyze
 * @param limit - Maximum number of keywords to return (default: 5)
 * @returns Array of {word, count} sorted by count descending
 */
export function getTopKeywords(texts: string[], limit = 5): KeywordCount[] {
  const wordCounts: Record<string, number> = {};

  for (const text of texts) {
    if (!text) continue;

    // 1. Lowercase and remove punctuation
    const cleanText = text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()«»"'"?]/g, " ");

    // 2. Split on whitespace
    const words = cleanText.split(/\s+/);

    for (const word of words) {
      // 3. Filter short words (≤2 chars) and ignored words
      if (word.length > 2 && !IGNORED_WORDS.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
  }

  // 4. Sort by count descending and return top N
  return Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Format a relative time string in Norwegian.
 * E.g., "2 timer siden", "I går", "3 dager siden"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Akkurat nå";
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? "1 minutt siden"
      : `${diffMinutes} minutter siden`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? "1 time siden" : `${diffHours} timer siden`;
  }
  if (diffDays === 1) return "I går";
  if (diffDays < 7) return `${diffDays} dager siden`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 uke siden" : `${weeks} uker siden`;
  }

  // For older dates, just show the date
  return date.toLocaleDateString("no-NO", {
    day: "numeric",
    month: "short",
  });
}
