import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const opaqueId = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => v.trim().length > 0);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const AnalysisTeamSchema = z.object({ team: text(255) });
export const AnalysisIdSchema = AnalysisTeamSchema.extend({
  productId: z.string().uuid(),
});
export const AnalysisSourceSelectionSchema = z
  .object({
    app: opaqueId(255),
    surveyId: opaqueId(255),
    fieldIds: z.array(opaqueId(200)).max(500),
  })
  .strict();
export const AnalysisDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: text(120),
    purpose: text(2_000),
    dataOwner: text(255),
    technicalOwner: text(255),
    processingReference: z.string().trim().max(500).nullable(),
    useCases: z
      .array(z.enum(["METABASE", "DATA_STORY_NOTEBOOK"]))
      .min(1)
      .max(2),
    retention: z.enum(["SOURCE_MAXIMUM", "DAYS_30", "DAYS_90", "DAYS_180"]),
    reviewDate: z.string().date(),
    sources: z.array(AnalysisSourceSelectionSchema).max(100),
    dimensionKeys: z
      .array(
        z
          .string()
          .regex(/^[A-Za-z0-9._-]+$/)
          .max(100),
      )
      .max(50),
    includeSubmittedHour: z.boolean(),
  })
  .strict();
export const AnalysisCreateSchema = AnalysisTeamSchema.extend({
  document: AnalysisDocumentSchema,
});
export const AnalysisSaveSchema = AnalysisIdSchema.extend({
  draftId: z.string().uuid(),
  draftRevision: z.number().int().positive(),
  document: AnalysisDocumentSchema,
});
export const AnalysisConfirmationSchema = z
  .object({
    draftId: z.string().uuid(),
    draftRevision: z.number().int().positive(),
    documentHash: hash,
    catalogRevision: text(255),
    publicationSpecificationDigest: hash,
  })
  .strict();
export const AnalysisLockSchema = AnalysisIdSchema.extend({
  confirmation: AnalysisConfirmationSchema,
});

const fieldType = z.enum([
  "RATING",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "TEXT",
  "DATE",
]);
const dependency = z.object({
  source: z.enum(["ANSWER", "METADATA"]),
  key: z.string(),
});
export const AnalysisCatalogSchema = z.object({
  demo: z.boolean().optional(),
  schemaVersion: z.literal(1),
  team: z.string(),
  catalogRevision: z.string(),
  sources: z.array(
    z.object({
      app: z.string(),
      surveyId: z.string(),
      archived: z.boolean(),
      definitionStatus: z.enum([
        "REGISTERED",
        "AUTO_DERIVED",
        "RETIRED",
        "MISSING",
      ]),
      flowStatus: z.enum(["PINNED", "UNPINNED"]),
      warnings: z.array(z.string()),
      fields: z.array(
        z.object({
          fieldId: z.string(),
          fieldType,
          label: z.string().nullable(),
          labelSource: z.string(),
          optionIds: z.array(z.string()).nullable(),
          ratingScale: z.number().nullable(),
          flowDependencies: z.array(dependency),
        }),
      ),
    }),
  ),
  dimensions: z.array(
    z.object({
      key: z.string(),
      description: z.string(),
      allowedValues: z.array(z.string()),
    }),
  ),
});
export const AnalysisProductSchema = z.object({
  id: z.string().uuid(),
  team: z.string(),
  lifecycleState: z.enum([
    "DRAFT",
    "ENABLED",
    "PAUSED",
    "OFFBOARDING",
    "DELETED",
  ]),
  lastReleaseNumber: z.number(),
  activeReleaseNumber: z.number().nullable(),
  desiredReleaseNumber: z.number().nullable(),
  updatedAt: z.string(),
  draft: z
    .object({
      id: z.string().uuid(),
      revision: z.number().int().positive(),
      documentHash: hash,
      document: AnalysisDocumentSchema,
    })
    .nullable(),
});
export const AnalysisResourceSchema = z.object({
  name: z.string(),
  kind: z.enum(["WIDE", "LONG", "FIELD_CATALOG", "MANIFEST"]),
  rowMeaning: z.string(),
  sourceApp: z.string().nullable(),
  sourceSurveyId: z.string().nullable(),
  columns: z.array(
    z.object({
      logicalId: z.string(),
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
      description: z.string(),
    }),
  ),
  syntheticRows: z.array(
    z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  ),
});
export const AnalysisIssueSchema = z.object({
  severity: z.enum(["WARNING", "BLOCKER"]),
  code: z.string(),
  sourceApp: z.string().nullish(),
  sourceSurveyId: z.string().nullish(),
  fieldId: z.string().nullish(),
  dimensionKey: z.string().nullish(),
});
// Read-only projection of the server's specification. It is never submitted
// as a release request, and does not recreate compiler or authorization logic.
const AnalysisPinnedFieldSchema = z
  .object({
    fieldId: opaqueId(200),
    presence: z.enum(["PRESENT", "ABSENT"]),
    fieldType: z.enum(["RATING", "SINGLE_CHOICE", "MULTI_CHOICE"]).nullable(),
    ratingVariant: z.enum(["emoji", "thumbs", "stars", "nps"]).nullable(),
    ratingScale: z.number().int().positive().nullable(),
    maxSelections: z.number().int().positive().nullable(),
    availableOptionIds: z.array(z.string()),
  })
  .superRefine((field, context) => {
    if (field.presence !== "PRESENT") return;
    const scales = { emoji: 5, thumbs: 2, stars: 5, nps: 11 };
    if (
      field.fieldType === null ||
      (field.fieldType === "RATING" &&
        (field.ratingVariant === null ||
          field.ratingScale !== scales[field.ratingVariant]))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid pinned field structure",
      });
    }
  });
export const AnalysisPublicationSummarySchema = z.object({
  schemaVersion: z.literal(2),
  productId: z.string().uuid(),
  team: z.string(),
  catalogRevision: z.string(),
  sources: z
    .array(
      z.object({
        app: opaqueId(255),
        surveyId: opaqueId(255),
        selectedFieldIds: z.array(opaqueId(200)).max(500),
        definitions: z.array(
          z.object({
            definitionHash: hash,
            fields: z.array(AnalysisPinnedFieldSchema),
          }),
        ),
      }),
    )
    .max(100),
});
export const AnalysisPreviewSchema = z
  .object({
    schemaVersion: z.literal(2),
    dataOrigin: z.literal("SYNTHETIC"),
    productId: z.string().uuid(),
    draftId: z.string().uuid(),
    draftRevision: z.number().int().positive(),
    documentHash: hash,
    catalogRevision: z.string(),
    publicationSpecificationDigest: hash.nullable(),
    status: z.enum(["READY", "READY_WITH_WARNINGS", "BLOCKED"]),
    resources: z.array(AnalysisResourceSchema),
    issues: z.array(AnalysisIssueSchema),
    excludedDataCategories: z.array(z.string()),
    publicationSpecification: AnalysisPublicationSummarySchema.nullish(),
  })
  .superRefine((preview, context) => {
    const specification = preview.publicationSpecification;
    if (
      specification &&
      (specification.productId !== preview.productId ||
        specification.catalogRevision !== preview.catalogRevision)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Specification does not match preview",
      });
    }
  });
export const AnalysisReleaseSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  releaseNumber: z.number().int().positive(),
  sourceDocument: AnalysisDocumentSchema,
  publishedAt: z.string(),
});

export type AnalysisDocument = z.infer<typeof AnalysisDocumentSchema>;
export type AnalysisProduct = z.infer<typeof AnalysisProductSchema>;
export type AnalysisCatalog = z.infer<typeof AnalysisCatalogSchema>;
export type AnalysisPreview = z.infer<typeof AnalysisPreviewSchema>;
export type AnalysisResource = z.infer<typeof AnalysisResourceSchema>;
export type AnalysisRelease = z.infer<typeof AnalysisReleaseSchema>;
export type AnalysisConfirmation = z.infer<typeof AnalysisConfirmationSchema>;
export type AnalysisMutationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason:
        | "conflict"
        | "not-editable"
        | "blocked"
        | "limit"
        | "unavailable"
        | "invalid-input"
        | "too-large";
    };

export function analysisConfirmation(
  preview: AnalysisPreview,
): AnalysisConfirmation | null {
  if (
    preview.status === "BLOCKED" ||
    preview.issues.some((issue) => issue.severity === "BLOCKER") ||
    !preview.publicationSpecificationDigest
  )
    return null;
  return AnalysisConfirmationSchema.parse({
    draftId: preview.draftId,
    draftRevision: preview.draftRevision,
    documentHash: preview.documentHash,
    catalogRevision: preview.catalogRevision,
    publicationSpecificationDigest: preview.publicationSpecificationDigest,
  });
}

export function emptyAnalysisDocument(): AnalysisDocument {
  return {
    schemaVersion: 1,
    name: "",
    purpose: "",
    dataOwner: "",
    technicalOwner: "",
    processingReference: null,
    useCases: [],
    retention: "DAYS_90",
    reviewDate: "",
    sources: [],
    dimensionKeys: [],
    includeSubmittedHour: false,
  };
}

export const analysisIssueText: Record<string, string> = {
  SOURCE_SELECTION_EMPTY:
    "Velg minst én survey. Du kan velge en survey uten svarfelt for å telle svar.",
  SOURCE_UNAVAILABLE:
    "En valgt survey er ikke tilgjengelig. Kontroller datagrunnlaget.",
  DEFINITION_NOT_REGISTERED: "Surveyen trenger en registrert V2-definisjon.",
  FLOW_NOT_PINNED: "Surveyen mangler en låst flyt fra V2-biblioteket.",
  FLOW_DEPENDENCY_NOT_SELECTED:
    "Et valgt felt avhenger av et annet felt eller en dimensjon som ikke er valgt.",
  FIELD_UNAVAILABLE: "Et valgt felt er ikke lenger tilgjengelig.",
  FIELD_NOT_ALLOWED: "Dette feltet kan ikke inngå i analyseeksporten.",
  DIMENSION_UNAVAILABLE: "En valgt dimensjon er ikke tilgjengelig.",
  UNPINNED_FLOW_HISTORY_EXCLUDED: "Eldre svar uten låst flyt vil ikke inngå.",
  WIDE_COLUMN_BUDGET_WARNING:
    "Tabellen nærmer seg grensen for antall kolonner.",
  WIDE_COLUMN_BUDGET_EXCEEDED:
    "For mange kolonner. Reduser feltvalget eller del opp produktet.",
};
