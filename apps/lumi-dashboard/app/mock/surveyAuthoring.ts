import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import type {
  SurveyAuthoringProject,
  SurveyAuthoringProjectSummary,
} from "~/types/surveyAuthoring";

const projects = new Map<string, SurveyAuthoringProject>();

export function listMockSurveyProjects(
  team: string,
): SurveyAuthoringProjectSummary[] {
  return [...projects.values()]
    .filter((project) => project.team === team)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ document: _document, ...summary }) => summary);
}

export function getMockSurveyProject(
  team: string,
  projectId: string,
): SurveyAuthoringProject | undefined {
  const project = projects.get(projectId);
  return project?.team === team ? structuredClone(project) : undefined;
}

export function createMockSurveyProject(input: {
  team: string;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
}): SurveyAuthoringProject {
  const now = new Date().toISOString();
  const project: SurveyAuthoringProject = {
    id: crypto.randomUUID(),
    team: input.team,
    name: input.name.trim(),
    surveyId: input.surveyId.trim(),
    document: structuredClone(input.document),
    draftVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  projects.set(project.id, project);
  return structuredClone(project);
}

export function saveMockSurveyProject(input: {
  team: string;
  projectId: string;
  expectedVersion: number;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
}): SurveyAuthoringProject {
  const current = projects.get(input.projectId);
  if (!current || current.team !== input.team) {
    throw new Error("Survey project not found");
  }
  if (current.draftVersion !== input.expectedVersion) {
    throw new Error("Draft changed since it was loaded");
  }

  const updated: SurveyAuthoringProject = {
    ...current,
    name: input.name.trim(),
    surveyId: input.surveyId.trim(),
    document: structuredClone(input.document),
    draftVersion: current.draftVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  projects.set(updated.id, updated);
  return structuredClone(updated);
}
