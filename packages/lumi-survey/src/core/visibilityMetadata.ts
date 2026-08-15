import type { LumiSurveyContext } from "./types.js";

/**
 * Builds the flat metadata map used by visibleIf and branching conditions.
 *
 * Tags keep their existing top-level keys. Defined context fields take
 * precedence over tags with the same name, while debug data is deliberately
 * excluded because it is intended only for submission diagnostics.
 */
export function getVisibilityMetadata(
  context: LumiSurveyContext | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const metadata: Record<string, unknown> = { ...context.tags };
  const contextFields: Record<string, unknown> = {
    url: context.url,
    pathname: context.pathname,
    viewport: context.viewport,
    screenResolution: context.screenResolution,
    deviceType: context.deviceType,
    userAgent: context.userAgent,
  };

  for (const [key, value] of Object.entries(contextFields)) {
    if (value !== undefined) {
      metadata[key] = value;
    }
  }

  return metadata;
}
