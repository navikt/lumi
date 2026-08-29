import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockStats } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { FeedbackStats } from "~/types/api";
import { StatsParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

export const STATS_DASHBOARD_PATH = "/api/v1/intern/stats/dashboard" as const;

interface StatsActionParams {
  team?: string;
  includeArchived?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  segment?: string;
  task?: string;
  rating?: string[];
  choice?: string[];
}

function toMockSearchParams(data: StatsActionParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.set(key, value.join(","));
      }
      continue;
    }

    if (value) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}

export function transformStatsToBackendParams(data: StatsActionParams) {
  return {
    team: data.team,
    includeArchived: data.includeArchived === "true" ? "true" : undefined,
    app: data.app,
    surveyId: data.surveyId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    deviceType: data.deviceType,
    segment: data.segment?.split(",").filter(Boolean),
    task: data.task,
    rating: data.rating,
    choice: data.choice,
  };
}

export function buildStatsDashboardUrl(
  backendUrl: string,
  data: StatsActionParams,
) {
  return buildUrl(
    backendUrl,
    STATS_DASHBOARD_PATH,
    transformStatsToBackendParams(data),
  );
}

export const fetchStatsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(StatsParamsSchema))
  .handler(async ({ data, context }): Promise<FeedbackStats> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockStats(toMockSearchParams(data));
    }

    const url = buildStatsDashboardUrl(backendUrl, data);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FeedbackStats>;
  });
