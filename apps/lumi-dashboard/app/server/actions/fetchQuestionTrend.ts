import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { getMockQuestionTrend } from "~/mock/mockData";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { QuestionTrendResponse } from "~/types/api";
import {
  QuestionTrendParamsSchema,
  QuestionTrendResponseSchema,
} from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";
import {
  type StatsActionParams,
  toStatsMockSearchParams,
  transformStatsToBackendParams,
} from "./fetchStats";

export const QUESTION_TREND_PATH =
  "/api/v1/intern/stats/question-trend" as const;

export interface QuestionTrendActionParams extends StatsActionParams {
  fieldId: string;
  interval: "day" | "week" | "month";
}

export function buildQuestionTrendUrl(
  backendUrl: string,
  data: QuestionTrendActionParams,
) {
  return buildUrl(backendUrl, QUESTION_TREND_PATH, {
    ...transformStatsToBackendParams(data),
    fieldId: data.fieldId,
    interval: data.interval,
  });
}

export const fetchQuestionTrendServerFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(QuestionTrendParamsSchema))
  .handler(async ({ data, context }): Promise<QuestionTrendResponse> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      await mockDelay();
      const response = getMockQuestionTrend(
        toStatsMockSearchParams(data),
        data.fieldId,
        data.interval,
      );
      if (!response) throw new Error("Fant ingen data for valgt spørsmål");
      return QuestionTrendResponseSchema.parse(response);
    }

    const response = await fetch(buildQuestionTrendUrl(backendUrl, data), {
      headers: getHeaders(oboToken),
    });
    await handleApiResponse(response);
    return QuestionTrendResponseSchema.parse(await response.json());
  });
