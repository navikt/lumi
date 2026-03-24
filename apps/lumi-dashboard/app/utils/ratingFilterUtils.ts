/**
 * Parse rating URL param into field-to-rating filters.
 * Format: "fieldId:value,fieldId2:value2" => { fieldId: value }
 */
export function parseRatingParam(
  rating: string | undefined,
): Record<string, string> {
  if (!rating) return {};

  const filters: Record<string, string> = {};
  for (const part of rating.split(",")) {
    const colonIndex = part.indexOf(":");
    if (colonIndex > 0) {
      const key = part.slice(0, colonIndex);
      const value = part.slice(colonIndex + 1);
      if (key && value) {
        filters[key] = value;
      }
    }
  }
  return filters;
}

export function stringifyRatingFilters(
  filters: Record<string, string>,
): string | undefined {
  const entries = Object.entries(filters);
  if (entries.length === 0) return undefined;
  return entries.map(([fieldId, value]) => `${fieldId}:${value}`).join(",");
}

export function splitRatingParam(
  rating: string | undefined,
): string[] | undefined {
  const parsed = parseRatingParam(rating);
  const entries = Object.entries(parsed);
  if (entries.length === 0) return undefined;
  return entries.map(([fieldId, value]) => `${fieldId}:${value}`);
}
