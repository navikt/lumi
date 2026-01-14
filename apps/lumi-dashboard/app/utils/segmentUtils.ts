/**
 * Shared utilities for segment (context.tags) handling.
 * Used across dashboard and feedback pages for filtering.
 */

/**
 * Parse segment URL param into key-value pairs.
 * Format: "key:value,key:value" => { key: value }
 *
 * @example
 * parseSegmentParam("harAktivSykmelding:Ja,uke:3")
 * // => { harAktivSykmelding: "Ja", uke: "3" }
 */
export function parseSegmentParam(
  segment: string | undefined,
): Record<string, string> {
  if (!segment) return {};

  const filters: Record<string, string> = {};
  for (const part of segment.split(",")) {
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

/**
 * Stringify segment filters back to URL param format.
 *
 * @example
 * stringifySegmentFilters({ harAktivSykmelding: "Ja", uke: "3" })
 * // => "harAktivSykmelding:Ja,uke:3"
 */
export function stringifySegmentFilters(
  filters: Record<string, string>,
): string | undefined {
  const entries = Object.entries(filters);
  if (entries.length === 0) return undefined;
  return entries.map(([k, v]) => `${k}:${v}`).join(",");
}

/**
 * Format camelCase key to human-readable label.
 * In production, labels should ideally come from API response.
 *
 * @example
 * formatMetadataLabel("harAktivSykmelding") // => "Har Aktiv Sykmelding"
 */
export function formatMetadataLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format metadata value for display.
 * Converts boolean strings to Norwegian.
 *
 * @example
 * formatMetadataValue("true") // => "Ja"
 * formatMetadataValue("false") // => "Nei"
 * formatMetadataValue("arbeidsgiver") // => "Arbeidsgiver"
 */
export function formatMetadataValue(value: string): string {
  if (value === "true") return "Ja";
  if (value === "false") return "Nei";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
