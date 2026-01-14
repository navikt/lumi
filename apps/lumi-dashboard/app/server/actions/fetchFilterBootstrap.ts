import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockFilterBootstrap } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { FilterBootstrapResponse } from "~/types/schemas";
import { FilterBootstrapParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Server function to fetch filter bootstrap data.
 *
 * This provides all data needed for FilterBar dropdowns in a single request:
 * - apps: List of available apps for the team
 * - surveysByApp: Surveys grouped by app
 * - tags: All available tags
 * - deviceTypes: Available device types
 *
 * This endpoint is designed for long caching (5-10 minutes).
 */
export const fetchFilterBootstrapServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(FilterBootstrapParamsSchema))
  .handler(async ({ data, context }): Promise<FilterBootstrapResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockFilterBootstrap(data.team);
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/filters/bootstrap", {
      team: data.team,
    });

    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<FilterBootstrapResponse>;
  });
