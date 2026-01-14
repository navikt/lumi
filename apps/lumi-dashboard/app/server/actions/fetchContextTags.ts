import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockContextTags } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { ContextTagsResponse } from "~/types/api";
import { ContextTagsParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Fetch available context tags and values for a specific survey.
 */
export const fetchContextTagsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(ContextTagsParamsSchema))
  .handler(async ({ data, context }): Promise<ContextTagsResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay(300);

      // Calculate actual context tags from mock data (with all filters)
      const contextTags = getMockContextTags(
        data.surveyId,
        data.team,
        data.maxCardinality ?? 15,
        data.task, // Pass task filter for Top Tasks drill-down
        data.segment,
        data.fromDate,
        data.toDate,
        data.deviceType,
        data.hasText ?? false,
        data.lowRating ?? false,
      );

      return {
        surveyId: data.surveyId,
        contextTags,
        maxCardinality: data.maxCardinality ?? 15,
      };
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}/context-tags`,
      {
        team: data.team,
        maxCardinality: String(data.maxCardinality ?? 10),
        task: data.task,
        segment: data.segment?.split(",").filter(Boolean),
        fromDate: data.fromDate,
        toDate: data.toDate,
        deviceType: data.deviceType,
        hasText: data.hasText === true ? "true" : undefined,
        lowRating: data.lowRating === true ? "true" : undefined,
      },
    );
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<ContextTagsResponse>;
  });
