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

    const backendParams = {
      team: data.team,
      app: data.app,
      surveyId: data.surveyId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      deviceType: data.deviceType,
      segment: data.segment?.split(",").filter(Boolean),
      task: data.task,
    };

    const url = buildUrl(backendUrl, "/api/v1/intern/stats", backendParams);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FeedbackStats>;
  });
