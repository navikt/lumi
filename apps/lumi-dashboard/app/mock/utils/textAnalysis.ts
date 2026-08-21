/**
 * Text analysis utilities for mock data.
 *
 * Provides Norwegian word stemming and theme keyword matching.
 */

// ============================================
// Norwegian Stemmer
// ============================================

/**
 * Simple Norwegian stemmer that removes common suffixes.
 * Handles definite articles, plurals, and verb forms.
 * Mirrors the backend implementation in DiscoveryService.kt.
 */
export function stemNorwegian(word: string): string {
  let stem = word.toLowerCase().trim();

  if (stem.length > 4 && stem.endsWith("s")) stem = stem.slice(0, -1);
  if (stem.length > 7 && /(?:heter|heten)$/.test(stem))
    return stem.slice(0, -5);
  if (stem.length > 5 && /(?:dom|het)$/.test(stem)) return stem.slice(0, -3);
  if (stem.length > 7 && /(?:elser|elsen)$/.test(stem))
    return stem.slice(0, -5);
  if (stem.length > 6 && /(?:ende|else|este|eren)$/.test(stem)) {
    return stem.slice(0, -4);
  }
  if (stem.length > 5 && /(?:ere|est|ene)$/.test(stem))
    return stem.slice(0, -3);
  if (stem.length > 4 && /(?:er|en|et|st|te)$/.test(stem)) {
    return stem.slice(0, -2);
  }
  if (stem.length > 3 && /[aen]$/.test(stem)) return stem.slice(0, -1);

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
  const textSegments = text
    .replace(/\[[A-ZÆØÅ][A-ZÆØÅ\s-]+\]/g, "…")
    .toLowerCase()
    .split(/[.!?;,:…\n\u2028\u2029]+/)
    .map((segment) =>
      segment
        .replace(/[^a-zæøå0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(stemNorwegian),
    );

  return keywords.some((keyword) => {
    const keywordTokens = keyword
      .toLowerCase()
      .replace(/[^a-zæøå0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(stemNorwegian);
    return (
      keywordTokens.length > 0 &&
      textSegments.some((segment) =>
        segment.some(
          (_, index) =>
            index + keywordTokens.length <= segment.length &&
            keywordTokens.every(
              (token, offset) => segment[index + offset] === token,
            ),
        ),
      )
    );
  });
}
