import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisDocument } from "~/types/analysisProducts";
import { DataSelection } from "../DataSelection";
import { catalog, document } from "./fixtures";

afterEach(cleanup);
function renderSelection(initial: AnalysisDocument) {
  let latest = initial;
  function Harness() {
    const [value, setValue] = useState(initial);
    latest = value;
    return (
      <DataSelection catalog={catalog} document={value} onChange={setValue} />
    );
  }
  render(<Harness />);
  return () => latest;
}

describe("DataSelection explicit scope", () => {
  it("selects a population-only survey without silently selecting any answer fields", () => {
    const latest = renderSelection({ ...document, sources: [] });
    fireEvent.click(screen.getByRole("checkbox", { name: "survey-a" }));
    expect(latest().sources).toEqual([
      { app: "app-a", surveyId: "survey-a", fieldIds: [] },
    ]);
    expect(screen.getByRole("checkbox", { name: "score" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "text" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "score" }));
    expect(latest().sources[0].fieldIds).toEqual(["score"]);
    expect(latest().dimensionKeys).toEqual([]);
    expect(latest().includeSubmittedHour).toBe(false);
  });

  it("keeps missing source fields and dimensions until the user removes them", () => {
    const initial = {
      ...document,
      sources: [
        {
          app: "app-a",
          surveyId: "survey-a",
          fieldIds: ["score", "retired-field"],
        },
        { app: "gone-app", surveyId: "gone-survey", fieldIds: ["gone-field"] },
      ],
      dimensionKeys: ["retired-dimension"],
    };
    const latest = renderSelection(initial);
    expect(
      screen.getByRole("checkbox", { name: "retired-field" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "gone-survey" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "gone-field" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "retired-dimension" }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "score" }));
    expect(
      latest().sources.find((source) => source.surveyId === "survey-a")
        ?.fieldIds,
    ).toEqual(["retired-field"]);
    expect(
      latest().sources.find((source) => source.surveyId === "gone-survey")
        ?.fieldIds,
    ).toEqual(["gone-field"]);
    expect(latest().dimensionKeys).toEqual(["retired-dimension"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "retired-field" }));
    expect(
      latest().sources.find((source) => source.surveyId === "survey-a")
        ?.fieldIds,
    ).toEqual([]);
  });

  it("keeps selected surveys visible while searching for an unrelated source", () => {
    renderSelection(document);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Søk etter app eller survey" }),
      { target: { value: "does-not-match" } },
    );
    expect(screen.getByRole("checkbox", { name: "survey-a" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "score" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ingen surveys samsvarer med søket.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Valgte surveys vises også, slik at du kan endre utvalget.",
    );
  });

  it("shows matching surveys before retained selections and trims the search", () => {
    render(
      <DataSelection
        catalog={{
          ...catalog,
          sources: [
            ...catalog.sources,
            { ...catalog.sources[0], surveyId: "survey-b", fields: [] },
          ],
        }}
        document={document}
        onChange={() => {}}
      />,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Søk etter app eller survey" }),
      { target: { value: "  SURVEY-B  " } },
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 survey samsvarer med søket.",
    );
    expect(screen.getAllByRole("checkbox")[0]).toHaveAccessibleName("survey-b");
    expect(screen.getByRole("checkbox", { name: "survey-a" })).toBeChecked();
  });
});
