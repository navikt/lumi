import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AnalysisPreviewSchema,
  analysisConfirmation,
} from "~/types/analysisProducts";
import { ContractPreview } from "../ContractPreview";
import { preview, productId, team } from "./fixtures";

afterEach(cleanup);

function backendPreview() {
  const fields = [
    {
      fieldId: "score",
      presence: "PRESENT",
      fieldType: "RATING",
      ratingVariant: "nps",
      ratingScale: 11,
      maxSelections: null,
      availableOptionIds: [],
    },
    {
      fieldId: "channel",
      presence: "PRESENT",
      fieldType: "SINGLE_CHOICE",
      ratingVariant: null,
      ratingScale: null,
      maxSelections: null,
      availableOptionIds: ["old-only", "shared"],
    },
    {
      fieldId: "later-field",
      presence: "ABSENT",
      fieldType: null,
      ratingVariant: null,
      ratingScale: null,
      maxSelections: null,
      availableOptionIds: [],
    },
  ];
  return {
    ...preview,
    publicationSpecification: {
      schemaVersion: 2,
      productId,
      team,
      catalogRevision: preview.catalogRevision,
      compilerVersion: "server-only",
      sources: [
        {
          app: "app-a",
          surveyId: "survey-a",
          selectedFieldIds: ["score", "channel", "later-field"],
          definitions: [
            { definitionHash: "c".repeat(64), fields, flows: [] },
            {
              definitionHash: "d".repeat(64),
              fields: [
                fields[0],
                { ...fields[1], availableOptionIds: ["shared", "new-only"] },
                {
                  ...fields[1],
                  fieldId: "later-field",
                  availableOptionIds: ["yes"],
                },
              ],
              flows: [],
            },
          ],
        },
      ],
    },
  };
}

describe("authoritative pinned selection", () => {
  it.each([
    ["WIDE", "Bruk den for å telle innsendinger"],
    ["LONG", "Antall rader er derfor ikke antall innsendinger"],
  ])("explains row counting and missing values for %s", (kind, explanation) => {
    render(
      <ContractPreview
        preview={AnalysisPreviewSchema.parse({
          ...preview,
          resources: [
            {
              name: "example",
              kind,
              rowMeaning: "Example rows",
              sourceApp: null,
              sourceSurveyId: null,
              columns: [],
              syntheticRows: [],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(new RegExp(explanation))).toBeVisible();
    expect(screen.getByText(/NULL betyr ingen verdi, ikke 0/)).toBeVisible();
  });

  it("shows every historical option and NPS 0–10 independently of synthetic examples", () => {
    render(
      <ContractPreview
        preview={AnalysisPreviewSchema.parse(backendPreview())}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Felt og tillatte verdier" }),
    );
    expect(
      screen.getByText("Tillatte alternativ-ID-er: new-only, old-only, shared"),
    ).toBeVisible();
    expect(screen.getByText("NPS: 0–10")).toBeVisible();
    expect(screen.queryByText("NPS: 1–11")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Feltet finnes ikke i alle tillatte definisjoner/),
    ).toBeVisible();
    expect(
      screen.getByText(/de fantes ikke nødvendigvis i alle versjoner/),
    ).toBeVisible();
  });

  it("keeps the read-only specification entirely out of the confirmation", () => {
    const parsed = AnalysisPreviewSchema.parse(backendPreview());
    expect(analysisConfirmation(parsed)).toEqual(analysisConfirmation(preview));
    expect(parsed.publicationSpecification).not.toHaveProperty(
      "compilerVersion",
    );
    expect(
      parsed.publicationSpecification?.sources[0].definitions[0],
    ).not.toHaveProperty("flows");
  });

  it("rejects malformed rating semantics and mismatched specification provenance", () => {
    const wrongScale = backendPreview();
    wrongScale.publicationSpecification.sources[0].definitions[0].fields[0].ratingScale = 5;
    expect(AnalysisPreviewSchema.safeParse(wrongScale).success).toBe(false);
    const wrongProduct = backendPreview();
    wrongProduct.publicationSpecification.productId =
      "44444444-4444-4444-8444-444444444444";
    expect(AnalysisPreviewSchema.safeParse(wrongProduct).success).toBe(false);
    const wrongCatalog = backendPreview();
    wrongCatalog.publicationSpecification.catalogRevision = "other";
    expect(AnalysisPreviewSchema.safeParse(wrongCatalog).success).toBe(false);
  });

  it("does not invent a complete field selection for a simplified demo or blocked preview", () => {
    render(<ContractPreview preview={AnalysisPreviewSchema.parse(preview)} />);
    expect(
      screen.queryByRole("button", { name: "Felt og tillatte verdier" }),
    ).not.toBeInTheDocument();
    expect(
      AnalysisPreviewSchema.safeParse({
        ...preview,
        status: "BLOCKED",
        publicationSpecification: null,
        publicationSpecificationDigest: null,
      }).success,
    ).toBe(true);
  });

  it("explains a pinned population-only selection without inventing fields", () => {
    const payload = backendPreview();
    payload.publicationSpecification.sources[0].selectedFieldIds = [];
    for (const definition of payload.publicationSpecification.sources[0]
      .definitions)
      definition.fields = [];
    render(<ContractPreview preview={AnalysisPreviewSchema.parse(payload)} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Felt og tillatte verdier" }),
    );
    expect(
      screen.getByText("Bare innsendinger, ingen svarfelt."),
    ).toBeVisible();
    expect(screen.queryByText("NPS: 0–10")).not.toBeInTheDocument();
  });
});
