export interface PhraseFilterValue {
  fieldId: string;
  surface: string;
}

/**
 * Parse URL phrase param into structured filter value.
 * Format: "fieldId:natural phrase text"
 * Splits on first ":", validates that fieldId is non-empty
 * and that the surface has at least two words with normalized whitespace.
 * The API verifies that the surface resolves to exactly two content words.
 */
export function parsePhraseParam(
  raw: string | undefined,
): PhraseFilterValue | null {
  if (!raw) return null;

  const colonIndex = raw.indexOf(":");
  if (colonIndex <= 0) return null;

  const fieldId = raw.slice(0, colonIndex).trim();
  const surface = raw
    .slice(colonIndex + 1)
    .trim()
    .split(/\s+/)
    .join(" ");

  if (!fieldId || !surface) return null;
  if (fieldId.length > 200 || !/^[\p{L}\p{N}_-]+$/u.test(fieldId)) return null;
  if (!/^[\p{L}\p{N}\s]+$/u.test(surface)) return null;

  // Natural display phrases may retain stopwords between the two content words.
  const words = surface.split(" ");
  if (words.length < 2) return null;
  if (words.some((w) => w.includes(":"))) return null;

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
