import type { z } from "zod";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
} from "~/server/utils";
import type { AnalysisMutationResult } from "~/types/analysisProducts";

export async function analysisRequest(
  context: AuthContext,
  team: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<Response> {
  if (isMockMode()) {
    const { mockAnalysisRequest } = await import("~/mock/analysisProducts");
    return mockAnalysisRequest(team, path, method, body);
  }
  return fetch(
    buildUrl(context.backendUrl, `/api/v1/intern/analysis-products${path}`, {
      team,
    }),
    {
      method,
      headers: getHeaders(context.oboToken),
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

export async function readAnalysis<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok)
    throw new Error(
      "Analyseproduktet kunne ikke hentes. Kontroller team og prøv igjen.",
    );
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("Uventet svar fra analyseprodukt-API-et.");
  return parsed.data;
}

export async function mutateAnalysis<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<AnalysisMutationResult<T>> {
  if (response.status === 400) return { ok: false, reason: "invalid-input" };
  if (response.status === 413) return { ok: false, reason: "too-large" };
  if (response.status === 409) {
    const body: unknown = await response.json().catch(() => null);
    const notEditable =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      body.error === "ANALYSIS_PRODUCT_NOT_EDITABLE";
    return { ok: false, reason: notEditable ? "not-editable" : "conflict" };
  }
  if (response.status === 422) return { ok: false, reason: "blocked" };
  if (response.status === 429) return { ok: false, reason: "limit" };
  if (response.status === 404 || response.status === 403)
    return { ok: false, reason: "unavailable" };
  if (!response.ok)
    throw new Error("Kunne ikke bekrefte om endringen ble lagret.");
  return { ok: true, value: await readAnalysis(response, schema) };
}
