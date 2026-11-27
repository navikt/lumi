import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { z } from "zod";

/** The component a survey is meant to be shown with. */
export type SurveyDisplayMode = "dock" | "inline";

/**
 * How the author means the survey to be shown in the app: as the floating
 * panel (`LumiSurveyDock`) or at the content it asks about
 * (`LumiSurveyInline`). It is stored beside the document and is not a part
 * of `SurveyDocumentV1`. The developer still decides where the survey is
 * placed.
 */
export interface SurveyPresentation {
  mode: SurveyDisplayMode;
  /** Where in the app the survey belongs, in the author's own words. */
  placementNote: string | null;
}

export const MAX_PLACEMENT_NOTE_LENGTH = 200;

/** What every survey was before the choice existed. */
export const FLOATING_PANEL_PRESENTATION: SurveyPresentation = {
  mode: "dock",
  placementNote: null,
};

/**
 * An API from before the choice existed sends no presentation. Its surveys
 * are shown as the floating panel, and `presentationUnknown` says that the
 * database can hold another choice.
 */
export function withPresentation<
  T extends {
    presentation?: SurveyPresentation | null;
    presentationUnknown?: boolean;
  },
>(value: T): T & { presentation: SurveyPresentation } {
  return value.presentation && !value.presentationUnknown
    ? { ...value, presentation: value.presentation }
    : {
        ...value,
        presentation: FLOATING_PANEL_PRESENTATION,
        presentationUnknown: true,
      };
}

/**
 * The answer to a save, read by an editor that knows which choice is stored.
 * A server or an API from before the choice existed leaves the choice out of
 * the answer. Neither of them saves it, so the stored choice is still the one
 * the editor knew.
 */
export function withStoredPresentation<
  T extends {
    presentation?: SurveyPresentation | null;
    presentationUnknown?: boolean;
  },
>(
  value: T,
  stored: SurveyPresentation,
): Omit<T, "presentationUnknown"> & { presentation: SurveyPresentation } {
  const { presentationUnknown, ...answer } = value;
  return {
    ...answer,
    presentation:
      value.presentation && !presentationUnknown ? value.presentation : stored,
  };
}

export interface SurveyAuthoringProject {
  id: string;
  team: string;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
  presentation: SurveyPresentation;
  /**
   * True when an API from before the choice existed sent the project.
   * `presentation` is then the floating panel only to show something, and
   * the editor must not save it over the choice that is stored.
   */
  presentationUnknown?: boolean;
  draftVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The newest frozen revision of a project, carried on the list so the
 * overview can open a shared survey on its stable version and tell whether
 * the draft has moved on since (draftVersion > latestRevision.draftVersion).
 */
export interface SurveyAuthoringLatestRevision {
  id: string;
  revisionNumber: number;
  draftVersion: number;
  createdAt: string;
}

export type SurveyAuthoringProjectSummary = Omit<
  SurveyAuthoringProject,
  "document"
> & {
  latestRevision?: SurveyAuthoringLatestRevision | null;
};

export interface SurveyAuthoringRevision {
  id: string;
  projectId: string;
  revisionNumber: number;
  draftVersion: number;
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
  /** The presentation as it was when the version was shared. */
  presentation: SurveyPresentation;
  /**
   * True when an API from before the choice existed sent the version.
   * `presentation` is then the floating panel only to show something.
   */
  presentationUnknown?: boolean;
  documentHash: string;
  definitionHash: string;
  createdBy: string;
  createdAt: string;
}

export type SurveyAuthoringRevisionSummary = Omit<
  SurveyAuthoringRevision,
  "document"
>;

/** False in the public demo, where Surveyverksted refuses every write. */
export interface SurveyAuthoringAccess {
  canSave: boolean;
}

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
  projectId: z.uuid(),
});

/** One short line of text. A blank note is no note. */
const placementNoteSchema = z
  .union([
    z.null(),
    z
      .string()
      .trim()
      .max(MAX_PLACEMENT_NOTE_LENGTH)
      // U+2028 and U+2029 break a line without being control characters.
      .regex(
        /^[^\p{Cc}\u2028\u2029]*$/u,
        "placementNote must be a single line of text",
      )
      // Half of a UTF-16 surrogate pair is no character. The database would
      // store a question mark in its place.
      .regex(/^\P{Cs}*$/u, "placementNote must be valid Unicode text"),
  ])
  .transform((note) => note || null);

export const SurveyPresentationSchema = z
  .object({
    mode: z.enum(["dock", "inline"]),
    placementNote: placementNoteSchema,
  })
  // The note describes a place at the content. The floating panel has none.
  .transform((presentation) =>
    presentation.mode === "dock"
      ? { ...presentation, placementNote: null }
      : presentation,
  );

/**
 * The presentation in an answer from Lumi API. An API from before the choice
 * existed sends none.
 */
const presentationAnswerSchema = z
  .object({
    mode: z.enum(["dock", "inline"]),
    placementNote: z.string().nullable(),
  })
  .optional();

/** The answer to a created or saved draft. */
export const SurveyAuthoringProjectAnswerSchema = z.object({
  id: z.string(),
  team: z.string(),
  name: z.string(),
  surveyId: z.string(),
  document: documentSchema,
  presentation: presentationAnswerSchema,
  draftVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The answer to a shared version. */
export const SurveyAuthoringRevisionAnswerSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  revisionNumber: z.number(),
  draftVersion: z.number(),
  name: z.string(),
  surveyId: z.string(),
  document: documentSchema,
  presentation: presentationAnswerSchema,
  documentHash: z.string(),
  definitionHash: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
});

/**
 * The presentation as the API stores it: the note trimmed, a blank note as
 * none, and no note for the floating panel. A presentation the API would
 * refuse is left as it is.
 */
export function presentationAsStored(
  presentation: SurveyPresentation,
): SurveyPresentation {
  const parsed = SurveyPresentationSchema.safeParse(presentation);
  return parsed.success ? parsed.data : presentation;
}

/**
 * Whether an answer is the draft `projectId` of `team`. A proxy in front of
 * the dashboard can answer with a page of its own, such as a login page, and
 * the client of a server function hands such an answer over as it is.
 */
export function isDraftAnswer(
  answer: unknown,
  team: string,
  projectId: string,
): boolean {
  if (typeof answer !== "object" || answer === null) return false;
  const draft = answer as Record<string, unknown>;
  const pages = (draft.document as { pages?: unknown } | null | undefined)
    ?.pages;
  return (
    draft.id === projectId &&
    draft.team === team &&
    typeof draft.name === "string" &&
    typeof draft.surveyId === "string" &&
    typeof draft.draftVersion === "number" &&
    Array.isArray(pages) &&
    pages.length > 0
  );
}

/**
 * Whether an answer is the version shared from `draftVersion` of the draft
 * `projectId`. A version from another draft version, such as an answer
 * cached by a proxy, does not share what the author sees.
 */
export function isRevisionAnswer(
  answer: unknown,
  projectId: string,
  draftVersion: number,
): boolean {
  if (typeof answer !== "object" || answer === null) return false;
  const revision = answer as Record<string, unknown>;
  return (
    typeof revision.id === "string" &&
    revision.projectId === projectId &&
    typeof revision.revisionNumber === "number" &&
    revision.draftVersion === draftVersion
  );
}

/**
 * Whether the server saved the presentation that was sent. A dashboard
 * server from before the choice existed leaves the presentation out of its
 * request, and the API keeps the choice it had. The API stores the
 * presentation as `SurveyPresentationSchema` reads it.
 */
export function savedAsSent(
  sent: SurveyPresentation,
  saved: {
    presentation?: SurveyPresentation | null;
    presentationUnknown?: boolean;
  },
): boolean {
  if (!saved.presentation || saved.presentationUnknown) return false;
  const expected = SurveyPresentationSchema.safeParse(sent);
  return (
    expected.success &&
    expected.data.mode === saved.presentation.mode &&
    expected.data.placementNote === (saved.presentation.placementNote ?? null)
  );
}

export const CreateSurveyAuthoringProjectSchema =
  SurveyAuthoringTeamSchema.extend({
    name: z.string().trim().min(1).max(120),
    surveyId: z.string().trim().min(1).max(200),
    document: documentSchema,
    // A page that was open before the choice existed sends none. A new
    // project is then the floating panel, and a saved draft keeps its
    // choice.
    presentation: SurveyPresentationSchema.optional(),
  });

export const SaveSurveyAuthoringDraftSchema =
  CreateSurveyAuthoringProjectSchema.extend({
    projectId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  });

export const CreateSurveyAuthoringRevisionSchema =
  SurveyAuthoringProjectIdSchema.extend({
    expectedDraftVersion: z.number().int().positive(),
  });

export const SurveyAuthoringRevisionIdSchema = SurveyAuthoringTeamSchema.extend(
  {
    revisionId: z.uuid(),
  },
);
