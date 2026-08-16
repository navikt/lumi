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
import type {
  SurveyAuthoringProject,
  SurveyAuthoringProjectSummary,
} from "~/types/surveyAuthoring";
import {
  CreateSurveyAuthoringProjectSchema,
  SaveSurveyAuthoringDraftSchema,
  SurveyAuthoringProjectIdSchema,
  SurveyAuthoringTeamSchema,
} from "~/types/surveyAuthoring";
import { handleApiResponse } from "../fetchUtils";

export const fetchSurveyAuthoringProjectsServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(SurveyAuthoringTeamSchema))
  .handler(
    async ({ data, context }): Promise<SurveyAuthoringProjectSummary[]> => {
      if (isMockMode()) {
        const { listMockSurveyProjects } = await import(
          "~/mock/surveyAuthoring"
        );
        await mockDelay();
        return listMockSurveyProjects(data.team);
      }

      const { backendUrl, oboToken } = context as AuthContext;
      const response = await fetch(
        buildUrl(backendUrl, "/api/v1/intern/authoring/projects", {
          team: data.team,
        }),
        { headers: getHeaders(oboToken) },
      );
      await handleApiResponse(response);
      return response.json() as Promise<SurveyAuthoringProjectSummary[]>;
    },
  );

export const fetchSurveyAuthoringProjectServerFn = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(SurveyAuthoringProjectIdSchema))
  .handler(async ({ data, context }): Promise<SurveyAuthoringProject> => {
    if (isMockMode()) {
      const { getMockSurveyProject } = await import("~/mock/surveyAuthoring");
      await mockDelay();
      const project = getMockSurveyProject(data.team, data.projectId);
      if (!project) throw new Error("Survey project not found");
      return project;
    }

    const { backendUrl, oboToken } = context as AuthContext;
    const response = await fetch(
      buildUrl(
        backendUrl,
        `/api/v1/intern/authoring/projects/${encodeURIComponent(data.projectId)}`,
        { team: data.team },
      ),
      { headers: getHeaders(oboToken) },
    );
    await handleApiResponse(response);
    return response.json() as Promise<SurveyAuthoringProject>;
  });

export const createSurveyAuthoringProjectServerFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(CreateSurveyAuthoringProjectSchema))
  .handler(async ({ data, context }): Promise<SurveyAuthoringProject> => {
    if (isMockMode()) {
      const { createMockSurveyProject } = await import(
        "~/mock/surveyAuthoring"
      );
      await mockDelay();
      return createMockSurveyProject(
        data as Parameters<typeof createMockSurveyProject>[0],
      );
    }

    const { backendUrl, oboToken } = context as AuthContext;
    const response = await fetch(
      buildUrl(backendUrl, "/api/v1/intern/authoring/projects", {
        team: data.team,
      }),
      {
        method: "POST",
        headers: getHeaders(oboToken),
        body: JSON.stringify({
          name: data.name,
          surveyId: data.surveyId,
          document: data.document,
        }),
      },
    );
    await handleApiResponse(response);
    return response.json() as Promise<SurveyAuthoringProject>;
  });

export const saveSurveyAuthoringDraftServerFn = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .inputValidator(zodValidator(SaveSurveyAuthoringDraftSchema))
  .handler(async ({ data, context }): Promise<SurveyAuthoringProject> => {
    if (isMockMode()) {
      const { saveMockSurveyProject } = await import("~/mock/surveyAuthoring");
      await mockDelay();
      return saveMockSurveyProject(
        data as Parameters<typeof saveMockSurveyProject>[0],
      );
    }

    const { backendUrl, oboToken } = context as AuthContext;
    const response = await fetch(
      buildUrl(
        backendUrl,
        `/api/v1/intern/authoring/projects/${encodeURIComponent(data.projectId)}/draft`,
        { team: data.team },
      ),
      {
        method: "PUT",
        headers: getHeaders(oboToken),
        body: JSON.stringify({
          expectedVersion: data.expectedVersion,
          name: data.name,
          surveyId: data.surveyId,
          document: data.document,
        }),
      },
    );
    await handleApiResponse(response);
    return response.json() as Promise<SurveyAuthoringProject>;
  });
