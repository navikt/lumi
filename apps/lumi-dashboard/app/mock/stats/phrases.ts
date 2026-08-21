import type { ConfidenceLevel, PhraseEntry, QuoteEntry } from "~/types/api";
import { stemNorwegian } from "../utils/textAnalysis";

interface TextWithMeta {
  text: string;
  submittedAt: string;
  id?: string;
}

// Keep this set aligned with TextProcessor.STOP_WORDS in the API. Phrase
// extraction deliberately removes stopwords before pairing content words.
const PHRASE_STOP_WORDS = new Set([
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
  "inn",
  "når",
  "være",
  "kom",
  "noen",
  "noe",
  "ville",
  "dere",
  "deres",
  "kun",
  "ja",
  "etter",
  "ned",
  "denne",
  "for",
  "deg",
  "to",
  "kunne",
  "skulle",
  "måtte",
  "må",
  "bør",
  "burde",
  "få",
  "fikk",
  "fått",
  "får",
  "gjøre",
  "gjort",
  "gjør",
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
  "hvis",
  "både",
  "bare",
  "fordi",
  "før",
  "mange",
  "også",
  "slik",
  "vært",
  "begge",
  "siden",
  "henne",
  "hennar",
  "hennes",
  "enten",
  "verken",
  "heller",
  "likevel",
  "altså",
  "derfor",
  "dersom",
  "imidlertid",
  "mer",
  "mye",
  "lite",
  "flere",
  "alt",
  "andre",
  "enn",
  "nok",
  "litt",
  "veldig",
  "ganske",
  "helt",
  "svært",
  "kanskje",
  "alltid",
  "aldri",
  "ofte",
  "gjerne",
  "igjen",
  "jo",
  "vel",
  "synes",
  "tror",
  "tenker",
  "vet",
  "vite",
  "mener",
  "opplever",
  "føler",
  "føles",
  "kommer",
  "komme",
  "går",
  "gå",
  "gikk",
  "gått",
  "ser",
  "sett",
  "tar",
  "tok",
  "tatt",
  "ikkje",
  "meir",
  "mykje",
  "nokon",
  "noko",
  "deira",
  "korleis",
  "kvifor",
  "heilt",
  "sjølv",
  "eigen",
  "kvar",
  "kven",
  "nav",
  "takk",
  "fjernet",
]);

interface StemmedBigram {
  surface: string;
  stemKey: string;
}

function phraseWords(text: string): string[] {
  return text
    .replace(/\[[A-ZÆØÅ][A-ZÆØÅ\s-]+\]/g, " ")
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !PHRASE_STOP_WORDS.has(word));
}

/** Mirrors TextProcessor.extractBigrams in the API. */
export function extractStemmedBigrams(text: string): StemmedBigram[] {
  const words = phraseWords(text);
  return words.slice(0, -1).map((word, index) => {
    const nextWord = words[index + 1];
    return {
      surface: `${word} ${nextWord}`,
      stemKey: `${stemNorwegian(word)}|${stemNorwegian(nextWord)}`,
    };
  });
}

export function phraseStemKey(surface: string): string | null {
  const words = phraseWords(surface);
  if (words.length !== 2) return null;
  return `${stemNorwegian(words[0])}|${stemNorwegian(words[1])}`;
}

export function textMatchesPhrase(text: string, surface: string): boolean {
  const expectedStemKey = phraseStemKey(surface);
  return (
    expectedStemKey !== null &&
    extractStemmedBigrams(text).some(
      (bigram) => bigram.stemKey === expectedStemKey,
    )
  );
}

/**
 * Extract bigrams, representative quotes, and confidence level from text responses.
 * Used by mock discovery and blocker stats to populate phrase fields.
 */
export function extractPhrases(
  responses: TextWithMeta[],
  { maxSourceIds = 5, maxPhrases = 30 } = {},
): {
  phrases: PhraseEntry[];
  quotes: QuoteEntry[];
  confidenceLevel: ConfidenceLevel;
} {
  const total = responses.length;
  const confidenceLevel: ConfidenceLevel =
    total < 30 ? "low" : total <= 100 ? "medium" : "high";

  // Build stem-grouped bigram counts, deduplicated per response.
  const bigramCounts = new Map<
    string,
    {
      count: number;
      sourceIds: string[];
      surfaceCounts: Map<string, number>;
    }
  >();

  for (const [idx, response] of responses.entries()) {
    const seenInResponse = new Set<string>();

    for (const bigram of extractStemmedBigrams(response.text)) {
      if (seenInResponse.has(bigram.stemKey)) continue;
      seenInResponse.add(bigram.stemKey);

      const existing = bigramCounts.get(bigram.stemKey);
      const sourceId = response.id ?? `mock-${idx}`;
      if (existing) {
        existing.count++;
        existing.sourceIds.push(sourceId);
        existing.surfaceCounts.set(
          bigram.surface,
          (existing.surfaceCounts.get(bigram.surface) ?? 0) + 1,
        );
      } else {
        bigramCounts.set(bigram.stemKey, {
          count: 1,
          sourceIds: [sourceId],
          surfaceCounts: new Map([[bigram.surface, 1]]),
        });
      }
    }
  }

  const phrases: PhraseEntry[] = Array.from(bigramCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxPhrases)
    .map(([, v]) => ({
      text:
        Array.from(v.surfaceCounts.entries()).sort(
          (left, right) =>
            right[1] - left[1] || left[0].localeCompare(right[0], "nb"),
        )[0]?.[0] ?? "",
      count: v.count,
      sourceResponseIds: v.sourceIds.slice(0, maxSourceIds),
    }));

  // Select 3-5 representative quotes (30-300 chars), deterministic
  const validQuotes = responses
    .filter((r) => r.text.length >= 30 && r.text.length <= 300)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const quoteCount = Math.min(5, validQuotes.length);
  const step =
    validQuotes.length > quoteCount
      ? Math.floor(validQuotes.length / quoteCount)
      : 1;

  const quotes: QuoteEntry[] = [];
  for (
    let i = 0;
    i < validQuotes.length && quotes.length < quoteCount;
    i += step
  ) {
    quotes.push({
      text: validQuotes[i].text,
      answeredAt: validQuotes[i].submittedAt,
    });
  }

  return { phrases, quotes, confidenceLevel };
}
