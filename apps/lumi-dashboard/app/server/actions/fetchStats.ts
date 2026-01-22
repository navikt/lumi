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

export function transformStatsToBackendParams(data: {
  team?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  segment?: string;
  task?: string;
  ratingFieldId?: string;
  ratingValue?: string;
}) {
  return {
    team: data.team,
    app: data.app,
    surveyId: data.surveyId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    deviceType: data.deviceType,
    segment: data.segment?.split(",").filter(Boolean),
    task: data.task,
    ratingFieldId: data.ratingFieldId,
    ratingValue: data.ratingValue,
  };
}

export function buildStatsDashboardUrl(
  backendUrl: string,
  data: {
    team?: string;
    app?: string;
    surveyId?: string;
    fromDate?: string;
    toDate?: string;
    deviceType?: string;
    segment?: string;
    task?: string;
    ratingFieldId?: string;
    ratingValue?: string;
  },
) {
  return buildUrl(
    backendUrl,
    STATS_DASHBOARD_PATH,
    transformStatsToBackendParams(data),
  );
}

/**
 * Fetch aggregated feedback statistics.
 * Supports filtering by app, date range, survey, and device type.
 */
export const fetchStatsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(StatsParamsSchema))
  .handler(async ({ data, context }): Promise<FeedbackStats> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value) searchParams.set(key, value);
      }
      return getMockStats(searchParams);
    }

    const url = buildStatsDashboardUrl(backendUrl, data);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FeedbackStats>;
  });
