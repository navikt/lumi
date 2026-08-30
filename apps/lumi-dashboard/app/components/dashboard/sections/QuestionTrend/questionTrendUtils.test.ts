import { describe, expect, it } from "vitest";
import type { QuestionTrendResponse } from "~/types/api";
import {
  fillQuestionTrendBuckets,
  formatQuestionTrendBucket,
} from "./questionTrendUtils";

const trend: QuestionTrendResponse = {
  fieldId: "rating-1",
  fieldType: "RATING",
  label: "Vurdering",
  interval: "week",
  privacyThreshold: 5,
  options: [],
  buckets: [
    {
      startDate: "2026-01-05",
      masked: false,
      responseCount: 5,
      average: 4,
      distribution: {},
    },
    {
      startDate: "2026-01-19",
      masked: true,
      distribution: {},
    },
  ],
};

describe("question trend calendar", () => {
  it("fills missing ISO calendar weeks without changing masked buckets", () => {
    const buckets = fillQuestionTrendBuckets(trend, "2026-01-07", "2026-01-25");

    expect(buckets.map((bucket) => bucket.startDate)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
    expect(buckets[1]).toMatchObject({ masked: false, responseCount: 0 });
    expect(buckets[2]?.responseCount).toBeUndefined();
  });

  it("uses understandable Norwegian day, ISO week and month labels", () => {
    expect(formatQuestionTrendBucket("2026-01-01", "day")).toBe("01.01.2026");
    expect(formatQuestionTrendBucket("2025-12-29", "week")).toBe(
      "Uke 1 · 29.12–04.01",
    );
    expect(formatQuestionTrendBucket("2026-08-01", "month")).toMatch(
      /^Aug 2026$/,
    );
  });
});
