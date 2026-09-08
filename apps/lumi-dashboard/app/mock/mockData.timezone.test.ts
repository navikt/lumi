import { afterAll, describe, expect, it, vi } from "vitest";
import { getMockStats } from "~/mock/mockData";

vi.hoisted(() => {
  // Fixtures are created on import. Freeze their date before loading the
  // module, without including cold module loading in the test's time budget.
  vi.setSystemTime(new Date("2026-08-22T22:30:00Z"));
});

describe("timezone-safe mock data", () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it("keeps the ordering survey inside the current Oslo date across UTC midnight", () => {
    const stats = getMockStats(
      new URLSearchParams({
        surveyId: "survey-ordering",
        fromDate: "2026-08-23",
        toDate: "2026-08-23",
      }),
    );

    expect(stats.totalCount).toBe(12);
    expect(stats.fieldStats?.map((field) => field.label)).toEqual([
      "Ordering Q1",
      "Ordering Q2",
      "Ordering Q3",
      "Ordering Q4",
    ]);
  });
});
