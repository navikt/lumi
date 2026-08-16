import {
  type SurveyDocumentV1,
  validateSurveyDocumentV1,
} from "@navikt/lumi-survey";
import type {
  SurveyAuthoringProject,
  SurveyAuthoringProjectSummary,
  SurveyAuthoringRevision,
  SurveyAuthoringRevisionDetail,
  SurveyAuthoringRevisionSummary,
} from "~/types/surveyAuthoring";
import { findHandoffIssues } from "~/utils/surveyDocument";
import {
  analyticalStructure,
  serializeSurveyDocumentJson,
} from "~/utils/surveyRevision";

const projects = new Map<string, SurveyAuthoringProject>();
const revisions = new Map<string, SurveyAuthoringRevision>();

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

export function listMockSurveyRevisions(
  team: string,
  projectId: string,
): SurveyAuthoringRevisionSummary[] {
  const project = projects.get(projectId);
  if (!project || project.team !== team)
    throw new Error("Survey project not found");
  return [...revisions.values()]
    .filter((revision) => revision.projectId === projectId)
    .sort((a, b) => b.revisionNumber - a.revisionNumber)
    .map(({ document: _document, ...summary }) => structuredClone(summary));
}

export async function createMockSurveyRevision(input: {
  team: string;
  projectId: string;
  expectedDraftVersion: number;
}): Promise<SurveyAuthoringRevision> {
  const project = projects.get(input.projectId);
  if (!project || project.team !== input.team)
    throw new Error("Survey project not found");
  if (project.draftVersion !== input.expectedDraftVersion) {
    throw new Error("Draft changed since it was validated");
  }
  const document = validateSurveyDocumentV1(structuredClone(project.document));
  // Mirror the API's release gate: drafts may be incomplete, revisions not.
  const handoffIssue = findHandoffIssues(document)[0];
  if (handoffIssue) {
    throw new Error(handoffIssue.message);
  }
  const projectRevisions = [...revisions.values()]
    .filter((revision) => revision.projectId === project.id)
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
  const previousForSurvey = projectRevisions.find(
    (revision) => revision.surveyId === project.surveyId,
  );
  if (
    previousForSurvey &&
    analyticalStructure(previousForSurvey.document) !==
      analyticalStructure(document)
  ) {
    throw new Error("Survey structure differs from the previous revision");
  }

  const documentHash = await sha256(serializeSurveyDocumentJson(document));
  const definitionHash = await sha256(analyticalStructure(document));
  const revision: SurveyAuthoringRevision = {
    id: crypto.randomUUID(),
    projectId: project.id,
    revisionNumber: (projectRevisions[0]?.revisionNumber ?? 0) + 1,
    draftVersion: project.draftVersion,
    name: project.name,
    surveyId: project.surveyId,
    document: structuredClone(document),
    documentHash,
    definitionHash,
    createdBy: "A123456",
    createdAt: new Date().toISOString(),
  };
  revisions.set(revision.id, revision);
  return structuredClone(revision);
}

export function getMockSurveyRevisionDetail(
  team: string,
  revisionId: string,
): SurveyAuthoringRevisionDetail | undefined {
  const revision = revisions.get(revisionId);
  const project = revision ? projects.get(revision.projectId) : undefined;
  if (!revision || !project || project.team !== team) return undefined;
  const previousRevision = [...revisions.values()]
    .filter(
      (candidate) =>
        candidate.projectId === revision.projectId &&
        candidate.revisionNumber < revision.revisionNumber,
    )
    .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
  return structuredClone({
    revision,
    previousRevision: previousRevision ?? null,
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
