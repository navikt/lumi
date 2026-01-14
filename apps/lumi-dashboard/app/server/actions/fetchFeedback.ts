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

/**
 * Transform frontend URL params to backend API params.
 */
function transformToBackendParams(data: Record<string, string | undefined>) {
  // Backend uses 0-indexed pages
  const page = data.page ? String(Number.parseInt(data.page, 10) - 1) : "0";

  const tag = data.tag
    ?.split(",")
    .map((t) => t.trim())
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
    // Transform segment format: "key:value,key:value" -> repeated params handled by buildUrl
    segment: data.segment?.split(",").filter(Boolean),
  };
}

/**
 * Fetch paginated feedback items with filtering support.
 */
export const fetchFeedbackServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FeedbackParamsSchema))
  .handler(async ({ data, context }): Promise<FeedbackPage> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value) searchParams.set(key, value);
      }
      // Backend uses 0-indexed pages, frontend uses 1-indexed
      const page = data.page ? String(Number.parseInt(data.page, 10) - 1) : "0";
      searchParams.set("page", page);
      return getMockFeedback(searchParams);
    }

    // Transform to backend param names
    const backendParams = transformToBackendParams(data);

    const url = buildUrl(backendUrl, "/api/v1/intern/feedback", backendParams);
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FeedbackPage>;
  });
