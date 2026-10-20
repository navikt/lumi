import type { z } from "zod";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
} from "~/server/utils";
import {
  type BigQueryExportResult,
  BigQueryExportVerificationSchema,
} from "~/types/bigQueryExport";

export type BigQueryExportPath = "" | "/verify" | "/run";

export async function bigQueryExportRequest(
  context: AuthContext,
  team: string,
  path: BigQueryExportPath,
  method = "GET",
  body?: unknown,
): Promise<Response> {
  if (isMockMode()) {
    const { mockBigQueryExportRequest } = await import("~/mock/bigQueryExport");
    return mockBigQueryExportRequest(team, path, method, body);
  }
  return fetch(
    buildUrl(context.backendUrl, `/api/v1/intern/bigquery-export${path}`, {
      team,
    }),
    {
      method,
      headers: getHeaders(context.oboToken),
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

export async function readBigQueryExport<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok)
    throw new Error(
      "BigQuery-eksporten kunne ikke hentes. Kontroller teamet og prøv igjen.",
    );
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("Uventet svar fra BigQuery-eksporten i Lumi API.");
  return parsed.data;
}

/**
 * Maps the API's answers to results the page can explain. A 422 carries the
 * problems that stopped a save, so the page can show what the team must fix.
 */
export async function mutateBigQueryExport<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<BigQueryExportResult<T>> {
  if (response.status === 422) {
    const parsed = BigQueryExportVerificationSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      throw new Error("Uventet svar fra BigQuery-eksporten i Lumi API.");
    return { ok: false, reason: "problems", problems: parsed.data.problems };
  }
  if (response.status === 400 || response.status === 413)
    return { ok: false, reason: "invalid-input" };
  if (response.status === 404) return { ok: false, reason: "not-configured" };
  if (response.status === 403 || response.status === 409)
    return { ok: false, reason: "unavailable" };
  if (response.status === 429) return { ok: false, reason: "limit" };
  if (!response.ok)
    throw new Error("Kunne ikke bekrefte om endringen ble lagret.");
  return { ok: true, value: await readBigQueryExport(response, schema) };
}
