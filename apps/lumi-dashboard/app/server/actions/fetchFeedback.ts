import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockFeedback } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { FeedbackPage } from "~/types/api";
import { FeedbackParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

interface FeedbackActionParams {
  team?: string;
  app?: string;
  surveyId?: string;
  page?: string;
  size?: string;
  fromDate?: string;
  toDate?: string;
  hasText?: string;
  query?: string;
  tag?: string;
  lowRating?: string;
  deviceType?: string;
  theme?: string;
  task?: string;
  segment?: string;
  choice?: string[];
  rating?: string[];
}

function toMockSearchParams(data: FeedbackActionParams): URLSearchParams {
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

  const page = data.page ? String(Number.parseInt(data.page, 10) - 1) : "0";
  searchParams.set("page", page);
  return searchParams;
}

function transformToBackendParams(data: FeedbackActionParams) {
  const page = data.page ? String(Number.parseInt(data.page, 10) - 1) : "0";
  const tag = data.tag
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    team: data.team,
    app: data.app,
    surveyId: data.surveyId,
    page,
    size: data.size,
    fromDate: data.fromDate,
    toDate: data.toDate,
    hasText: data.hasText === "true" ? "true" : undefined,
    lowRating: data.lowRating === "true" ? "true" : undefined,
    query: data.query,
    tag: tag && tag.length > 0 ? tag : undefined,
    deviceType: data.deviceType,
    theme: data.theme,
    task: data.task,
    segment: data.segment?.split(",").filter(Boolean),
    choice: data.choice,
    rating: data.rating,
  };
}

export { transformToBackendParams };

export const fetchFeedbackServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FeedbackParamsSchema))
  .handler(async ({ data, context }): Promise<FeedbackPage> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockFeedback(toMockSearchParams(data));
    }

    const backendParams = transformToBackendParams(data);
    const url = buildUrl(backendUrl, "/api/v1/intern/feedback", backendParams);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FeedbackPage>;
  });
