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

interface TaskPriorityActionParams {
  team?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  segment?: string;
  rating?: string[];
  choice?: string[];
}

function toMockSearchParams(data: TaskPriorityActionParams): URLSearchParams {
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

export const fetchTaskPriorityServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TaskPriorityParamsSchema))
  .handler(async ({ data, context }): Promise<TaskPriorityResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockTaskPriorityStats(toMockSearchParams(data));
    }

    const backendParams = {
      team: data.team,
      app: data.app,
      surveyId: data.surveyId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      deviceType: data.deviceType,
      segment: data.segment?.split(",").filter(Boolean),
      rating: data.rating,
      choice: data.choice,
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
