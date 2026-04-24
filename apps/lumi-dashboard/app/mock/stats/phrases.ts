import type { ConfidenceLevel, PhraseEntry, QuoteEntry } from "~/types/api";
import { STOP_WORDS } from "../utils/textAnalysis";

interface TextWithMeta {
  text: string;
  submittedAt: string;
  id?: string;
}

/**
 * Extract bigrams, representative quotes, and confidence level from text responses.
 * Used by mock discovery and blocker stats to populate phrase fields.
 */
export function extractPhrases(responses: TextWithMeta[]): {
  phrases: PhraseEntry[];
  quotes: QuoteEntry[];
  confidenceLevel: ConfidenceLevel;
} {
  const total = responses.length;
  const confidenceLevel: ConfidenceLevel =
    total < 30 ? "low" : total <= 100 ? "medium" : "high";

  // Build bigram counts, deduplicated per response
  const bigramCounts = new Map<
    string,
    { count: number; sourceIds: string[] }
  >();

  for (const [idx, response] of responses.entries()) {
    // Tokenize but keep all words — filter stopwords per-bigram, not before.
    // This ensures bigrams reflect adjacent words in the original text
    // so "vanskelig å svare" → bigram "vanskelig svare" is avoided.
    const words = response.text
      .toLowerCase()
      .replace(/[^\wæøå\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const seenInResponse = new Set<string>();

    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i];
      const b = words[i + 1];
      // Both words must be content words (not stopwords, length > 2)
      if (a.length <= 2 || b.length <= 2) continue;
      if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue;

      const bigram = `${a} ${b}`;
      if (seenInResponse.has(bigram)) continue;
      seenInResponse.add(bigram);

      const existing = bigramCounts.get(bigram);
      const sourceId = response.id ?? `mock-${idx}`;
      if (existing) {
        existing.count++;
        existing.sourceIds.push(sourceId);
      } else {
        bigramCounts.set(bigram, { count: 1, sourceIds: [sourceId] });
      }
    }
  }

  const phrases: PhraseEntry[] = Array.from(bigramCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([text, v]) => ({
      text,
      count: v.count,
      sourceResponseIds: v.sourceIds,
    }));

  // Select 3-5 representative quotes (30-300 chars), deterministic
  const validQuotes = responses
    .filter((r) => r.text.length >= 30 && r.text.length <= 300)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const quoteCount = Math.min(Math.max(3, Math.floor(total / 20)), 5);
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
