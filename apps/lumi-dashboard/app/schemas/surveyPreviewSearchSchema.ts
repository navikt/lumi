import { z } from "zod";

/** An empty value in the address counts as a missing one. */
function optionalParam<T extends z.ZodTypeAny>(schema: T) {
  return z.union([z.literal("").transform(() => undefined), schema]).optional();
}

/**
 * Search params for /survey-preview. «Prøv i egen fane» in Surveyverksted
 * always adds team and projectId. They are optional here, so an address
 * without them gets an explanation instead of an error page with HTTP 500.
 * Unlike the dashboard's search params, a value that is present must be
 * valid, so the fields have no fallback().
 */
export const surveyPreviewSearchSchema = z.object({
  team: optionalParam(z.string()),
  projectId: optionalParam(z.string().uuid()),
  version: optionalParam(z.coerce.number().int().positive()),
});
