import type {
  AnalysisCatalog,
  AnalysisDocument,
  AnalysisPreview,
  AnalysisProduct,
} from "~/types/analysisProducts";

export const team = "team-esyfo";
export const productId = "11111111-1111-4111-8111-111111111111";
export const draftId = "22222222-2222-4222-8222-222222222222";
export const document: AnalysisDocument = {
  schemaVersion: 1,
  name: "Surveyanalyse",
  purpose: "Forstå brukeropplevelsen",
  dataOwner: "A123456",
  technicalOwner: "A654321",
  processingReference: null,
  useCases: ["METABASE"],
  retention: "DAYS_90",
  reviewDate: "2026-10-01",
  sources: [{ app: "app-a", surveyId: "survey-a", fieldIds: ["score"] }],
  dimensionKeys: [],
  includeSubmittedHour: false,
};
export const product: AnalysisProduct = {
  id: productId,
  team,
  lifecycleState: "DRAFT",
  lastReleaseNumber: 0,
  activeReleaseNumber: null,
  desiredReleaseNumber: null,
  updatedAt: "2026-09-09T12:00:00Z",
  draft: {
    id: draftId,
    revision: 1,
    documentHash: "a".repeat(64),
    document,
  },
};
export const preview: AnalysisPreview = {
  schemaVersion: 2,
  dataOrigin: "SYNTHETIC",
  productId,
  draftId,
  draftRevision: 1,
  documentHash: "a".repeat(64),
  catalogRevision: "selection-specific-catalog",
  publicationSpecificationDigest: "b".repeat(64),
  status: "READY",
  resources: [],
  issues: [],
  excludedDataCategories: ["TEXT_ANSWERS"],
};
export const catalog: AnalysisCatalog = {
  schemaVersion: 1,
  team,
  catalogRevision: "whole-team-catalog",
  sources: [
    {
      app: "app-a",
      surveyId: "survey-a",
      archived: false,
      definitionStatus: "REGISTERED",
      flowStatus: "PINNED",
      warnings: [],
      fields: [
        {
          fieldId: "score",
          fieldType: "RATING",
          label: null,
          labelSource: "UNKNOWN",
          optionIds: null,
          ratingScale: 5,
          flowDependencies: [],
        },
        {
          fieldId: "text",
          fieldType: "TEXT",
          label: null,
          labelSource: "UNKNOWN",
          optionIds: null,
          ratingScale: null,
          flowDependencies: [],
        },
      ],
    },
  ],
  dimensions: [
    {
      key: "deviceType",
      description: "Enhetstype",
      allowedValues: ["mobile", "desktop"],
    },
  ],
};
