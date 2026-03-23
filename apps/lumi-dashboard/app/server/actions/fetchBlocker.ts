import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockBlockerStats } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { BlockerResponse } from "~/types/api";
import { BlockerParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

interface BlockerActionParams {
  team?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  task?: string;
  rating?: string[];
  choice?: string[];
}

function toMockSearchParams(data: BlockerActionParams): URLSearchParams {
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

export const fetchBlockerServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(BlockerParamsSchema))
  .handler(async ({ data, context }): Promise<BlockerResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockBlockerStats(toMockSearchParams(data));
    }

    const backendParams = {
      team: data.team,
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
      "/api/v1/intern/stats/blockers",
      backendParams,
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<BlockerResponse>;
  });
