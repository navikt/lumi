import { createServerFn } from "@tanstack/react-start";
import { lumiApiFetch } from "~/server/lumiApiFetch";
import { authMiddleware } from "~/server/middleware/auth";
import { refuseWriteInPublicDemo } from "~/server/publicDemo";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { DeleteSurveyResult } from "~/types/api";
import { DeleteFeedbackSchema, DeleteSurveySchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Delete all feedback for a specific survey.
 */
export const deleteSurveyServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(DeleteSurveySchema)
  .handler(async ({ data, context }): Promise<DeleteSurveyResult> => {
    refuseWriteInPublicDemo();
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      const { deleteMockSurvey } = await import("~/mock/mockData");
      await mockDelay();
      return deleteMockSurvey(data.surveyId);
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}`,
      { team: data.team },
    );
    const response = await lumiApiFetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<DeleteSurveyResult>;
  });

/**
 * Delete a single feedback item by ID.
 */
export const deleteFeedbackServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(DeleteFeedbackSchema)
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    refuseWriteInPublicDemo();
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      const { deleteMockFeedback } = await import("~/mock/mockData");
      await mockDelay();
      const deleted = deleteMockFeedback(data.id);
      return { success: deleted };
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/feedback/${encodeURIComponent(data.id)}`,
      { team: data.team },
    );
    const response = await lumiApiFetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return { success: true };
  });
