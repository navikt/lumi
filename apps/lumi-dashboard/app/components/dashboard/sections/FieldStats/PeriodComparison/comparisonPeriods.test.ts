import { describe, expect, it } from "vitest";
import { getComparisonPeriods } from "./comparisonPeriods";

const today = "2026-09-07";

describe("calendar-aware comparison periods", () => {
  it("compares both rolling days and year-to-date to the preceding period", () => {
    const rolling = getComparisonPeriods(
      "2026-01-01",
      "2026-01-07",
      undefined,
      "2026-01-08",
      "rolling",
    );
    const year = getComparisonPeriods(
      "2026-01-01",
      "2026-01-07",
      undefined,
      "2026-01-08",
      "yearToDate",
    );
    expect(rolling?.previous).toMatchObject({
      fromDate: "2025-12-25",
      toDate: "2025-12-31",
    });
    expect(year?.previous).toMatchObject({
      fromDate: "2025-12-25",
      toDate: "2025-12-31",
    });
  });

  it("keeps rolling 30-day windows equal even when they coincide with a calendar month", () => {
    const result = getComparisonPeriods(
      "2026-06-01",
      "2026-06-30",
      undefined,
      "2026-07-01",
      "rolling",
    );
    expect(result).toMatchObject({
      previous: { fromDate: "2026-05-02", toDate: "2026-05-31" },
      currentDays: 30,
      previousDays: 30,
    });
  });

  it("preserves explicit comparison preferences over the preset default", () => {
    expect(
      getComparisonPeriods(
        "2026-01-01",
        "2026-01-07",
        "none",
        "2026-01-08",
        "yearToDate",
      )?.mode,
    ).toBe("none");
    expect(
      getComparisonPeriods(
        "2026-01-01",
        "2026-01-07",
        "previous",
        "2026-01-08",
        "rolling",
      )?.mode,
    ).toBe("previous");
  });
  it.each([
    ["2025-01-01", "2025-12-31", "2024-01-01", "2024-12-31", "Forrige år"],
    ["2024-01-01", "2024-12-31", "2023-01-01", "2023-12-31", "Forrige år"],
    ["2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28", "Forrige måned"],
    ["2024-03-01", "2024-03-31", "2024-02-01", "2024-02-29", "Forrige måned"],
    [
      "2026-04-01",
      "2026-06-30",
      "2026-01-01",
      "2026-03-31",
      "Foregående 3 måneder",
    ],
    ["2026-08-24", "2026-08-30", "2026-08-17", "2026-08-23", "Forrige uke"],
    [
      "2026-08-19",
      "2026-09-01",
      "2026-08-05",
      "2026-08-18",
      "Foregående 14 dager",
    ],
    [
      "2026-09-06",
      "2026-09-06",
      "2026-09-05",
      "2026-09-05",
      "Foregående 1 dag",
    ],
  ])("resolves %s–%s without calendar drift", (from, to, previousFrom, previousTo, label) => {
    const result = getComparisonPeriods(from, to, undefined, today);
    expect(result).toMatchObject({
      previous: { fromDate: previousFrom, toDate: previousTo },
      label,
      mode: "previous",
      incomplete: false,
    });
    expect(result?.previous.label).toContain(previousFrom.slice(0, 4));
  });

  it("defaults year-to-date to the immediately preceding period", () => {
    expect(
      getComparisonPeriods("2026-01-01", "2026-09-06", undefined, today),
    ).toMatchObject({
      mode: "previous",
      previous: { fromDate: "2025-04-27", toDate: "2025-12-31" },
      incomplete: false,
    });
  });

  it("preserves an explicit previous-period choice for year-to-date", () => {
    expect(
      getComparisonPeriods("2026-01-01", "2026-09-06", "previous", today),
    ).toMatchObject({
      mode: "previous",
      previous: { fromDate: "2025-04-27", toDate: "2025-12-31" },
    });
  });

  it("compares a leap day to the preceding day", () => {
    expect(
      getComparisonPeriods("2024-02-29", "2024-02-29", "previous", today),
    ).toMatchObject({
      previous: { fromDate: "2024-02-28", toDate: "2024-02-28" },
    });
  });

  it("reports unequal calendar lengths for submission-count context", () => {
    expect(
      getComparisonPeriods("2025-01-01", "2025-12-31", undefined, today),
    ).toMatchObject({
      currentDays: 365,
      previousDays: 366,
    });
  });

  it.each([
    "2026-09-07",
    "2026-09-08",
    "2026-12-31",
  ])("marks periods ending %s incomplete", (to) => {
    expect(
      getComparisonPeriods("2026-01-01", to, undefined, today)?.incomplete,
    ).toBe(true);
  });

  it("retains the no-comparison choice", () => {
    expect(
      getComparisonPeriods("2026-01-01", "2026-09-06", "none", today)?.mode,
    ).toBe("none");
  });

  it.each([
    ["2026-09-01", "2026-09-06", false, false],
    ["2026-09-01", "2026-09-07", true, false],
    ["2026-09-07", "2026-09-07", true, false],
    ["2026-09-01", "2026-09-08", true, true],
    ["2026-09-08", "2026-09-09", false, true],
  ] as const)("distinguishes today from future dates for %s–%s", (from, to, includesToday, hasFutureDates) => {
    expect(getComparisonPeriods(from, to, undefined, today)).toMatchObject({
      includesToday,
      hasFutureDates,
      current: { fromDate: from, toDate: to },
    });
  });

  it("rejects invalid reference dates", () => {
    expect(
      getComparisonPeriods("2026-01-01", "2026-02-01", undefined, "invalid"),
    ).toBeUndefined();
  });
});
