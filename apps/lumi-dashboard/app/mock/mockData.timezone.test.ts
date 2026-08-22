import { afterEach, describe, expect, it, vi } from "vitest";

describe("timezone-safe mock data", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("keeps the ordering survey inside the current Oslo date across UTC midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T22:30:00Z"));
    vi.resetModules();

    const { getMockStats } = await import("~/mock/mockData");
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
