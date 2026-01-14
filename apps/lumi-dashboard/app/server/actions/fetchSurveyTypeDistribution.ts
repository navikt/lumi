import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockSurveyTypeDistribution } from "~/mock/mockData";
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

export interface SurveyTypeCount {
  type: string;
  count: number;
  percentage: number;
}

export interface SurveyTypeDistributionResponse {
  totalSurveys: number;
  distribution: SurveyTypeCount[];
}

/**
 * Fetch survey type distribution statistics.
 * Returns count of surveys per type (rating, topTasks, discovery, taskPriority, custom).
 */
export const fetchSurveyTypeDistributionServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(TeamParamsSchema))
  .handler(
    async ({ data, context }): Promise<SurveyTypeDistributionResponse> => {
      const { backendUrl, oboToken } = context as AuthContext;

      if (isMockMode()) {
        await mockDelay();
        return getMockSurveyTypeDistribution(data.team);
      }

      const url = buildUrl(backendUrl, "/api/v1/intern/stats/survey-types", {
        team: data.team,
      });
      const response = await fetch(url, {
        headers: getHeaders(oboToken),
      });

      await handleApiResponse(response);

      return response.json() as Promise<SurveyTypeDistributionResponse>;
    },
  );
