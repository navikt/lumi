import { describe, expect, it } from "vitest";
import {
  escapeCsvValue,
  generateCsvExport,
  isPotentialCsvFormula,
} from "~/utils/csv-export";

describe("csv-export helpers", () => {
  it("detects potential formula values", () => {
    expect(isPotentialCsvFormula("=1+1")).toBe(true);
    expect(isPotentialCsvFormula("+SUM(A1:A2)")).toBe(true);
    expect(isPotentialCsvFormula("-2+3")).toBe(true);
    expect(isPotentialCsvFormula("@foo")).toBe(true);
    expect(isPotentialCsvFormula(" =1+1")).toBe(true);
    expect(isPotentialCsvFormula("\t=1+1")).toBe(true);
    expect(isPotentialCsvFormula("normal tekst")).toBe(false);
  });

  it("escapes and prefixes potential formulas", () => {
    expect(escapeCsvValue("=1+1")).toBe(`"'=1+1"`);
    expect(escapeCsvValue("a,b")).toBe(`"a,b"`);
    expect(escapeCsvValue('a"b')).toBe(`"a""b"`);
  });

  it("applies formula protection in generated csv rows", async () => {
    const response = generateCsvExport([
      {
        id: "1",
        app: "app",
        surveyId: "survey",
        submittedAt: "2026-01-01T00:00:00Z",
        answers: [
          {
            fieldId: "text",
            fieldType: "TEXT",
            question: { label: "Kommentar" },
            value: { type: "text", text: "=cmd|' /C calc'!A0" },
          },
        ],
      },
    ]);

    const csv = await response.text();
    expect(csv).toContain(`"'=cmd|' /C calc'!A0"`);
  });
});
