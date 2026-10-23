import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockFilterBootstrap, getMockTeams } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import { ApiErrorException, ErrorType } from "~/types/errors";
import type {
  FilterBootstrapParams,
  FilterBootstrapResponse,
} from "~/types/schemas";
import { FilterBootstrapParamsSchema } from "~/types/schemas";
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

/**
 * Like the API, mock mode refuses a team the viewer is not a member of, so a
 * shared link to another team can be tried locally (`?team=team-x`).
 */
export const assertMockTeamAccess = createServerOnlyFn(
  (team: string | undefined): void => {
    if (!team || Object.hasOwn(getMockTeams().teams, team)) return;

    throw new ApiErrorException({
      status: 403,
      type: ErrorType.AUTHORIZATION_ERROR,
      message: `Du har ikke tilgang til team: ${team}`,
      timestamp: new Date().toISOString(),
    });
  },
);

async function requestFilterBootstrap(
  data: FilterBootstrapParams,
  context: AuthContext,
): Promise<FilterBootstrapResponse> {
  if (isMockMode()) {
    await mockDelay();
    assertMockTeamAccess(data.team);
    return getMockFilterBootstrap(data.team);
  }

  const url = buildFilterBootstrapUrl(context.backendUrl, data);
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
  .validator(zodValidator(FilterBootstrapParamsSchema))
  .handler(async ({ data, context }): Promise<FilterBootstrapResponse> => {
    return requestFilterBootstrap(data, context as AuthContext);
  });
