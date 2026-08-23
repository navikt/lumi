import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
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
import type {
  FilterBootstrapParams,
  FilterBootstrapResponse,
  RefreshFilterBootstrapParams,
} from "~/types/schemas";
import {
  FilterBootstrapParamsSchema,
  RefreshFilterBootstrapParamsSchema,
} from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

export const FILTER_BOOTSTRAP_PATH =
  "/api/v1/intern/filters/bootstrap" as const;

export function buildFilterBootstrapUrl(
  backendUrl: string,
  data: FilterBootstrapParams,
) {
  return buildUrl(backendUrl, FILTER_BOOTSTRAP_PATH, {
    team: data.team,
  });
}

export function buildRefreshFilterBootstrapUrl(
  backendUrl: string,
  data: RefreshFilterBootstrapParams,
) {
  return buildUrl(backendUrl, FILTER_BOOTSTRAP_PATH, {
    team: data.team,
    refresh: "true",
  });
}

async function requestFilterBootstrap(
  data: FilterBootstrapParams | RefreshFilterBootstrapParams,
  context: AuthContext,
  forceRefresh: boolean,
): Promise<FilterBootstrapResponse> {
  if (isMockMode()) {
    await mockDelay();
    return getMockFilterBootstrap(data.team);
  }

  const url = forceRefresh
    ? buildRefreshFilterBootstrapUrl(context.backendUrl, data)
    : buildFilterBootstrapUrl(context.backendUrl, data);
  const response = await fetch(url, {
    headers: getHeaders(context.oboToken),
  });

  await handleApiResponse(response);
  return response.json() as Promise<FilterBootstrapResponse>;
}

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
    return requestFilterBootstrap(data, context as AuthContext, false);
  });

/** Explicit, uncached refresh. POST keeps this user action out of GET caches. */
export const refreshFilterBootstrapServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(RefreshFilterBootstrapParamsSchema))
  .handler(async ({ data, context }): Promise<FilterBootstrapResponse> => {
    setResponseHeader("Cache-Control", "private, no-store");
    return requestFilterBootstrap(data, context as AuthContext, true);
  });
