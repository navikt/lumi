import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "~/components/export/TopTasksExport";

describe("TopTasksExport csv escaping", () => {
  it("escapes quotes", () => {
    expect(escapeCsvCell('hei "du"')).toBe(`"hei ""du"""`);
  });

  it("prefixes potential formulas", () => {
    expect(escapeCsvCell("=1+1")).toBe(`"'=1+1"`);
    expect(escapeCsvCell(" +SUM(A1:A2)")).toBe(`"' +SUM(A1:A2)"`);
  });
});
