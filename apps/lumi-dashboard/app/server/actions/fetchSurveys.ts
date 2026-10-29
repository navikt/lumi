import { createServerFn } from "@tanstack/react-start";
import { getMockSurveysByApp } from "~/mock/mockData";
import { lumiApiFetch } from "~/server/lumiApiFetch";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import { TeamParamsSchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Fetch surveys grouped by application.
 */
export const fetchSurveysByAppServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(TeamParamsSchema)
  .handler(async ({ data, context }): Promise<Record<string, string[]>> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      return getMockSurveysByApp(data.team);
    }

    const url = buildUrl(backendUrl, "/api/v1/intern/surveys", {
      team: data.team,
    });
    const response = await lumiApiFetch(url, {
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<Record<string, string[]>>;
  });
