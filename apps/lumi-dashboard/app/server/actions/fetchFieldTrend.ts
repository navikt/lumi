import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockFieldTrend } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { FieldTrendResponse } from "~/types/api";
import { FieldTrendParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

export const FIELD_TREND_PATH = "/api/v1/intern/stats/field-trend" as const;

type FieldTrendActionParams = typeof FieldTrendParamsSchema._output;

function toMockSearchParams(data: FieldTrendActionParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length > 0) searchParams.set(key, value.join(","));
    } else if (value) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}

export function buildFieldTrendUrl(
  backendUrl: string,
  data: FieldTrendActionParams,
) {
  return buildUrl(backendUrl, FIELD_TREND_PATH, {
    ...data,
    includeArchived: data.includeArchived === "true" ? "true" : undefined,
    segment: data.segment?.split(",").filter(Boolean),
  });
}

export const fetchFieldTrendServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FieldTrendParamsSchema))
  .handler(async ({ data, context }): Promise<FieldTrendResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockFieldTrend(toMockSearchParams(data));
    }

    const response = await fetch(buildFieldTrendUrl(backendUrl, data), {
      headers: getHeaders(oboToken),
    });
    await handleApiResponse(response);
    return response.json() as Promise<FieldTrendResponse>;
  });
