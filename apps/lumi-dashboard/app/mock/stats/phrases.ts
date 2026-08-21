import type { ConfidenceLevel, PhraseEntry, QuoteEntry } from "~/types/api";
import { stemNorwegian } from "../utils/textAnalysis";

interface TextWithMeta {
  text: string;
  submittedAt: string;
  id?: string;
}

// Keep this set aligned with TextProcessor.STOP_WORDS in the API. Stopwords
// are omitted from grouping keys, but retained in natural display text.
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
  previousStemKey?: string;
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rawPhraseWords(text: string): string[] {
  return text
    .replace(/\[[A-ZÆØÅ][A-ZÆØÅ\s-]+\]/g, " ")
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function phraseWords(text: string): string[] {
  return rawPhraseWords(text).filter(
    (word) => word.length > 2 && !PHRASE_STOP_WORDS.has(word),
  );
}

/** Mirrors TextProcessor.extractBigrams in the API. */
export function extractStemmedBigrams(text: string): StemmedBigram[] {
  return text
    .split(/[.!?;,:…\n\u2028\u2029]+/)
    .flatMap((segment) => extractStemmedBigramsFromSegment(segment));
}

function extractStemmedBigramsFromSegment(text: string): StemmedBigram[] {
  const words = rawPhraseWords(text);
  const contentWordIndexes = words.flatMap((word, index) =>
    word.length > 2 && !PHRASE_STOP_WORDS.has(word) ? [index] : [],
  );
  let previousStemKey: string | undefined;
  return contentWordIndexes.slice(0, -1).map((firstIndex, index) => {
    const secondIndex = contentWordIndexes[index + 1];
    const word = words[firstIndex];
    const nextWord = words[secondIndex];
    const bigram = {
      surface: words.slice(firstIndex, secondIndex + 1).join(" "),
      stemKey: `${stemNorwegian(word)}|${stemNorwegian(nextWord)}`,
      previousStemKey,
    };
    previousStemKey = bigram.stemKey;
    return bigram;
  });
}

export function phraseStemKey(surface: string): string | null {
  const words = phraseWords(surface);
  if (words.length !== 2) return null;
  if (words.some((word) => word.length > 30)) return null;
  if (words.join(" ").length > 80) return null;
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

export function extractTopKeywords(
  texts: string[],
  limit = 5,
): Array<{ word: string; count: number }> {
  const accumulators = new Map<
    string,
    { count: number; surfaces: Map<string, number> }
  >();

  for (const text of texts) {
    for (const word of phraseWords(text)) {
      const stem = stemNorwegian(word);
      const accumulator = accumulators.get(stem) ?? {
        count: 0,
        surfaces: new Map<string, number>(),
      };
      accumulator.count++;
      accumulator.surfaces.set(word, (accumulator.surfaces.get(word) ?? 0) + 1);
      accumulators.set(stem, accumulator);
    }
  }

  return Array.from(accumulators.entries())
    .sort(
      ([leftStem, left], [rightStem, right]) =>
        right.count - left.count || compareCodePoints(leftStem, rightStem),
    )
    .slice(0, limit)
    .map(([, accumulator]) => ({
      word:
        Array.from(accumulator.surfaces.entries()).sort(
          ([leftSurface, leftCount], [rightSurface, rightCount]) =>
            rightCount - leftCount ||
            compareCodePoints(leftSurface, rightSurface),
        )[0]?.[0] ?? "",
      count: accumulator.count,
    }));
}

/**
 * Extract recurring phrases, representative quotes, and confidence level from text responses.
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

  // Build stem-grouped phrase counts, deduplicated per response.
  const bigramCounts = new Map<
    string,
    {
      count: number;
      sourceIds: string[];
      surfaceCounts: Map<string, number>;
      adjacentSourceIds: Map<string, Set<string>>;
    }
  >();

  for (const [idx, response] of responses.entries()) {
    const seenInResponse = new Set<string>();
    const sourceId = response.id ?? `mock-${idx}`;
    const bigrams = extractStemmedBigrams(response.text);

    for (const bigram of bigrams) {
      if (seenInResponse.has(bigram.stemKey)) continue;
      seenInResponse.add(bigram.stemKey);

      const existing = bigramCounts.get(bigram.stemKey);
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
          adjacentSourceIds: new Map(),
        });
      }
    }

    for (const bigram of bigrams) {
      if (!bigram.previousStemKey) continue;
      const accumulator = bigramCounts.get(bigram.stemKey);
      if (!accumulator) continue;
      const adjacentIds =
        accumulator.adjacentSourceIds.get(bigram.previousStemKey) ?? new Set();
      adjacentIds.add(sourceId);
      accumulator.adjacentSourceIds.set(bigram.previousStemKey, adjacentIds);
    }
  }

  const candidates = Array.from(bigramCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || compareCodePoints(a[0], b[0]));
  const selected: typeof candidates = [];
  const grouped = new Set<string>();

  const isRelatedWindow = (
    [leftKey, left]: (typeof candidates)[number],
    [rightKey, right]: (typeof candidates)[number],
  ) => {
    const smallerSize = Math.min(left.sourceIds.length, right.sourceIds.length);
    if (smallerSize === 0) return false;
    const observedTogether = new Set([
      ...(left.adjacentSourceIds.get(rightKey) ?? []),
      ...(right.adjacentSourceIds.get(leftKey) ?? []),
    ]);
    return observedTogether.size / smallerSize >= 0.8;
  };

  for (const candidate of candidates) {
    if (grouped.has(candidate[0])) continue;
    selected.push(candidate);
    grouped.add(candidate[0]);

    const queue = [candidate];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const other of candidates) {
        if (grouped.has(other[0]) || !isRelatedWindow(current, other)) continue;
        grouped.add(other[0]);
        queue.push(other);
      }
    }
    if (selected.length === maxPhrases) break;
  }

  const phrases: PhraseEntry[] = selected.map(([, v]) => ({
    text:
      Array.from(v.surfaceCounts.entries()).sort(
        (left, right) =>
          right[1] - left[1] || compareCodePoints(left[0], right[0]),
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
