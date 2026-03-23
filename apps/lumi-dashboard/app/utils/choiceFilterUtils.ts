/**
 * Parse choice URL param into field-to-option filters.
 * Format: "fieldId:value,fieldId2:value2" => { fieldId: value }
 */
export function parseChoiceParam(
  choice: string | undefined,
): Record<string, string> {
  if (!choice) return {};

  const filters: Record<string, string> = {};
  for (const part of choice.split(",")) {
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

export function stringifyChoiceFilters(
  filters: Record<string, string>,
): string | undefined {
  const entries = Object.entries(filters);
  if (entries.length === 0) return undefined;
  return entries.map(([fieldId, value]) => `${fieldId}:${value}`).join(",");
}

export function splitChoiceParam(
  choice: string | undefined,
): string[] | undefined {
  const parsed = parseChoiceParam(choice);
  const entries = Object.entries(parsed);
  if (entries.length === 0) return undefined;
  return entries.map(([fieldId, value]) => `${fieldId}:${value}`);
}
