import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { z } from "zod";

export interface SurveyAuthoringProject {
  id: string;
  team: string;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
  draftVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type SurveyAuthoringProjectSummary = Omit<
  SurveyAuthoringProject,
  "document"
>;

export interface SurveyAuthoringRevision {
  id: string;
  projectId: string;
  revisionNumber: number;
  draftVersion: number;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
  documentHash: string;
  definitionHash: string;
  createdBy: string;
  createdAt: string;
}

export type SurveyAuthoringRevisionSummary = Omit<
  SurveyAuthoringRevision,
  "document"
>;

export interface SurveyAuthoringRevisionDetail {
  revision: SurveyAuthoringRevision;
  previousRevision: SurveyAuthoringRevision | null;
}

const documentSchema = z.custom<SurveyDocumentV1>(
  (value) =>
    Boolean(
      value &&
        typeof value === "object" &&
        "authoringSchemaVersion" in value &&
        value.authoringSchemaVersion === 1,
    ),
  "Only authoringSchemaVersion 1 is supported",
);

export const SurveyAuthoringTeamSchema = z.object({
  team: z.string().trim().min(1).max(255),
});

export const SurveyAuthoringProjectIdSchema = SurveyAuthoringTeamSchema.extend({
  projectId: z.string().uuid(),
});

export const CreateSurveyAuthoringProjectSchema =
  SurveyAuthoringTeamSchema.extend({
    name: z.string().trim().min(1).max(120),
    surveyId: z.string().trim().min(1).max(200),
    document: documentSchema,
  });

export const SaveSurveyAuthoringDraftSchema =
  CreateSurveyAuthoringProjectSchema.extend({
    projectId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  });

export const CreateSurveyAuthoringRevisionSchema =
  SurveyAuthoringProjectIdSchema.extend({
    expectedDraftVersion: z.number().int().positive(),
  });

export const SurveyAuthoringRevisionIdSchema = SurveyAuthoringTeamSchema.extend(
  {
    revisionId: z.string().uuid(),
  },
);
