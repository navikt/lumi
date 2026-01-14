import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockTaskPriorityStats } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { TaskPriorityResponse } from "~/types/api";
import { TaskPriorityParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Fetch Task Priority survey statistics for vote-based task analysis.
 * Returns the "Long Neck" distribution of task votes.
 */
export const fetchTaskPriorityServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TaskPriorityParamsSchema))
  .handler(async ({ data, context }): Promise<TaskPriorityResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value) searchParams.set(key, value);
      }
      return getMockTaskPriorityStats(searchParams);
    }

    const backendParams = {
      team: data.team,
      app: data.app,
      surveyId: data.surveyId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      deviceType: data.deviceType,
      // Backend expects repeated params: segment=key:value&segment=key:value
      segment: data.segment?.split(",").filter(Boolean),
    };

    const url = buildUrl(
      backendUrl,
      "/api/v1/intern/stats/task-priority",
      backendParams,
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<TaskPriorityResponse>;
  });
