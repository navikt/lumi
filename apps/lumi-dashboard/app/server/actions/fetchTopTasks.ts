import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockTopTasksStats } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { TopTasksResponse } from "~/types/api";
import { TopTasksParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

interface TopTasksActionParams {
  team?: string;
  includeArchived?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  task?: string;
  rating?: string[];
  choice?: string[];
}

function toMockSearchParams(data: TopTasksActionParams): URLSearchParams {
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

export const fetchTopTasksServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TopTasksParamsSchema))
  .handler(async ({ data, context }): Promise<TopTasksResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockTopTasksStats(toMockSearchParams(data));
    }

    const backendParams = {
      team: data.team,
      includeArchived: data.includeArchived === "true" ? "true" : undefined,
      app: data.app,
      surveyId: data.surveyId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      deviceType: data.deviceType,
      task: data.task,
      rating: data.rating,
      choice: data.choice,
    };

    const url = buildUrl(
      backendUrl,
      "/api/v1/intern/stats/top-tasks",
      backendParams,
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<TopTasksResponse>;
  });
