import { describe, expect, it } from "vitest";
import {
  AnalysisConfirmationSchema,
  AnalysisDocumentSchema,
  type AnalysisPreview,
  AnalysisResourceSchema,
  analysisConfirmation,
  emptyAnalysisDocument,
} from "./analysisProducts";

const preview: AnalysisPreview = {
  schemaVersion: 2,
  dataOrigin: "SYNTHETIC",
  productId: "10000000-0000-4000-8000-000000000001",
  draftId: "10000000-0000-4000-8000-000000000002",
  draftRevision: 7,
  documentHash: "a".repeat(64),
  catalogRevision: "selection-scoped-revision",
  publicationSpecificationDigest: "b".repeat(64),
  status: "READY",
  resources: [],
  issues: [],
  excludedDataCategories: [],
};

describe("analysis contract boundary", () => {
  it("confirms exactly the five fingerprints from the selected preview", () => {
    expect(analysisConfirmation(preview)).toEqual({
      draftId: preview.draftId,
      draftRevision: 7,
      documentHash: preview.documentHash,
      catalogRevision: "selection-scoped-revision",
      publicationSpecificationDigest: preview.publicationSpecificationDigest,
    });
  });

  it.each([
    { status: "BLOCKED" as const },
    { publicationSpecificationDigest: null },
    { issues: [{ severity: "BLOCKER" as const, code: "FUTURE_BLOCKER" }] },
  ])("cannot confirm a blocked or incomplete preview: %j", (changes) => {
    expect(analysisConfirmation({ ...preview, ...changes })).toBeNull();
  });

  it("allows warnings without interpreting unknown warning codes", () => {
    expect(
      analysisConfirmation({
        ...preview,
        status: "READY_WITH_WARNINGS",
        issues: [{ severity: "WARNING", code: "FUTURE_WARNING" }],
      }),
    ).not.toBeNull();
  });

  it("cannot add client-built specifications or actors to confirmation", () => {
    expect(
      AnalysisConfirmationSchema.safeParse({
        ...analysisConfirmation(preview),
        publicationSpecification: {},
        actor: "someone",
      }).success,
    ).toBe(false);
  });

  it("starts with no implicit data selections and permits population-only sources", () => {
    const document = emptyAnalysisDocument();
    expect(document.sources).toEqual([]);
    expect(document.dimensionKeys).toEqual([]);
    expect(document.includeSubmittedHour).toBe(false);
    expect(
      AnalysisDocumentSchema.parse({
        ...document,
        name: "Test",
        purpose: "Analyse",
        dataOwner: "Eier",
        technicalOwner: "Team",
        useCases: ["METABASE"],
        reviewDate: "2026-12-01",
        sources: [{ app: "app", surveyId: "survey", fieldIds: [] }],
      }).sources[0].fieldIds,
    ).toEqual([]);
  });

  it("rejects nested values in the flat table preview", () => {
    const resource = {
      name: "test",
      kind: "WIDE",
      rowMeaning: "row",
      sourceApp: null,
      sourceSurveyId: null,
      columns: [],
      syntheticRows: [{ value: { nested: true } }],
    };
    expect(AnalysisResourceSchema.safeParse(resource).success).toBe(false);
    expect(
      AnalysisResourceSchema.safeParse({
        ...resource,
        syntheticRows: [
          { string: "value", number: 2, boolean: false, missing: null },
        ],
      }).success,
    ).toBe(true);
  });
});
