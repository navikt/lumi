import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { authMiddleware } from "~/server/middleware/auth";
import {
  type AuthContext,
  buildUrl,
  getHeaders,
  isMockMode,
  mockDelay,
} from "~/server/utils";
import type { SurveyArchiveState } from "~/types/schemas";
import { ArchiveSurveySchema } from "~/types/schemas";
import { handleApiResponse } from "../fetchUtils";

/**
 * Archive a survey (team-scoped display metadata).
 * Archiving only hides the survey in the dashboard — it does not stop submissions.
 */
export const archiveSurveyServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(ArchiveSurveySchema))
  .handler(async ({ data, context }): Promise<SurveyArchiveState> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      const { archiveMockSurvey } = await import("~/mock/mockData");
      await mockDelay();
      return archiveMockSurvey(data.surveyId);
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}/archive`,
      { team: data.team },
    );
    const response = await fetch(url, {
      method: "PUT",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);

    return response.json() as Promise<SurveyArchiveState>;
  });

/**
 * Restore an archived survey.
 */
export const unarchiveSurveyServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(zodValidator(ArchiveSurveySchema))
  .handler(async ({ data, context }): Promise<void> => {
    const { backendUrl, oboToken } = context as AuthContext;

    if (isMockMode()) {
      const { unarchiveMockSurvey } = await import("~/mock/mockData");
      await mockDelay();
      unarchiveMockSurvey(data.surveyId);
      return;
    }

    const url = buildUrl(
      backendUrl,
      `/api/v1/intern/surveys/${encodeURIComponent(data.surveyId)}/archive`,
      { team: data.team },
    );
    const response = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(oboToken),
    });

    await handleApiResponse(response);
  });
