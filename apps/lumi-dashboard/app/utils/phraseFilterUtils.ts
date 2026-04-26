export interface PhraseFilterValue {
  fieldId: string;
  surface: string;
}

/**
 * Parse URL phrase param into structured filter value.
 * Format: "fieldId:word1 word2"
 * Splits on first ":", validates that fieldId is non-empty
 * and surface is "word word" (one space between words, each word ≥1 char).
 */
export function parsePhraseParam(
  raw: string | undefined,
): PhraseFilterValue | null {
  if (!raw) return null;

  const colonIndex = raw.indexOf(":");
  if (colonIndex <= 0) return null;

  const fieldId = raw.slice(0, colonIndex);
  const surface = raw.slice(colonIndex + 1);

  if (!fieldId || !surface) return null;

  // Validate surface: must be exactly two words (bigram) separated by single space, no colons allowed
  const words = surface.split(" ");
  if (words.length !== 2) return null;
  if (words.some((w) => w.length === 0 || w.includes(":"))) return null;

  return { fieldId, surface };
}

/**
 * Stringify phrase filter to URL param format.
 * Returns "fieldId:surface"
 */
export function stringifyPhraseFilter(
  fieldId: string,
  surface: string,
): string {
  return `${fieldId}:${surface}`;
}
