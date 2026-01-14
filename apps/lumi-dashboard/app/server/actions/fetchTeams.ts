import { createServerFn } from "@tanstack/react-start";
import { getMockTeams } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { TeamsAndApps } from "~/types/api";
import { handleApiResponse } from "../fetchUtils";

/**
 * Fetch teams and their applications for filtering.
 */
export const fetchTeamsServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TeamsAndApps> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockTeams();
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/teams");
    const response = await fetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<TeamsAndApps>;
  });
