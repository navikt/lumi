import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockDiscoveryStats } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { DiscoveryResponse } from "~/types/api";
import { DiscoveryParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

interface DiscoveryActionParams {
  team?: string;
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  rating?: string[];
  choice?: string[];
}

function toMockSearchParams(data: DiscoveryActionParams): URLSearchParams {
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

export const fetchDiscoveryServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(DiscoveryParamsSchema))
  .handler(async ({ data, context }): Promise<DiscoveryResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockDiscoveryStats(toMockSearchParams(data));
    }

    const backendParams = {
      team: data.team,
      app: data.app,
      surveyId: data.surveyId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      deviceType: data.deviceType,
      rating: data.rating,
      choice: data.choice,
    };

    const url = buildUrl(
      backendUrl,
      "/api/v1/intern/stats/discovery",
      backendParams,
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<DiscoveryResponse>;
  });
