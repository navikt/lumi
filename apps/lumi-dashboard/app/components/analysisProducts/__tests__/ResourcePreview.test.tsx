import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisResource } from "~/types/analysisProducts";
import { ContractPreview } from "../ContractPreview";
import { ResourcePreview } from "../ResourcePreview";
import { preview } from "./fixtures";

afterEach(cleanup);

const resource: AnalysisResource = {
  name: "responses_app_survey_7eba041247a67eabedaba63f_wide_v1",
  kind: "WIDE",
  rowMeaning: "One synthetic row represents one submission.",
  sourceApp: "app",
  sourceSurveyId: "survey",
  columns: [
    {
      logicalId: "rating",
      name: "field_rating_eff34c89b6d6ea63e2562de1__rating",
      type: "INT64",
      nullable: true,
      description: "Rating value.",
    },
    {
      logicalId: "applicable",
      name: "field_rating_eff34c89b6d6ea63e2562de1__applicable",
      type: "BOOL",
      nullable: false,
      description: "Whether the field was applicable.",
    },
  ],
  syntheticRows: [
    {
      field_rating_eff34c89b6d6ea63e2562de1__rating: 0,
      field_rating_eff34c89b6d6ea63e2562de1__applicable: false,
    },
    {
      field_rating_eff34c89b6d6ea63e2562de1__rating: null,
      field_rating_eff34c89b6d6ea63e2562de1__applicable: true,
    },
  ],
};

describe("export resource presentation", () => {
  it("preserves exact column names, order, zero, false and NULL", () => {
    render(<ResourcePreview resource={resource} />);
    expect(screen.getByText(resource.name)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Kopier tabellnavn" }),
    ).toBeVisible();
    const region = screen.getByRole("region", { name: /Eksempelrader, rull/ });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveAccessibleDescription(/Alle 2 kolonner/);
    expect(
      within(region)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(resource.columns.map((column) => column.name));
    expect(within(region).getByRole("cell", { name: "0" })).toBeVisible();
    expect(within(region).getByRole("cell", { name: "false" })).toBeVisible();
    expect(within(region).getByTitle("Ingen verdi")).toHaveTextContent("NULL");
  });

  it("offers the full schema separately without a second wide table", () => {
    render(<ResourcePreview resource={resource} />);
    fireEvent.click(screen.getByRole("tab", { name: "Kolonner (2)" }));
    const panel = screen.getByRole("tabpanel", { name: "Kolonner (2)" });
    for (const column of resource.columns) {
      expect(within(panel).getByText(column.name)).toBeVisible();
      expect(within(panel).getByText(column.type)).toBeVisible();
      expect(within(panel).getByText(column.description)).toBeVisible();
    }
    expect(within(panel).getByText("Kan mangle (NULL)")).toBeVisible();
    expect(within(panel).getByText("Har alltid en verdi")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Eksempelrader" }));
    expect(screen.getByRole("table")).toBeVisible();
  });

  it("shows an explicit empty state and still allows schema inspection", () => {
    render(<ResourcePreview resource={{ ...resource, syntheticRows: [] }} />);
    expect(
      screen.getByText("Ingen eksempelrader i denne forhåndsvisningen."),
    ).toBeVisible();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Kolonner (2)" }));
    expect(screen.getByText("Rating value.")).toBeVisible();
  });

  it("resets to example rows when selecting another resource", () => {
    render(
      <ContractPreview
        preview={{
          ...preview,
          resources: [
            resource,
            { ...resource, name: "answer_values_long_v1", kind: "LONG" },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Kolonner (2)" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tabell" }), {
      target: { value: "answer_values_long_v1" },
    });
    expect(screen.getByRole("tab", { name: "Eksempelrader" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("answer_values_long_v1")).toBeVisible();
    expect(
      screen.getByText(/Antall rader er derfor ikke antall innsendinger/),
    ).toBeVisible();
  });
});
