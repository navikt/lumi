import { describe, expect, it } from "vitest";
import type { FeedbackDto } from "~/types/api";
import { createRatingAnswer } from "./helpers";
import { calculateQuestionTrend } from "./questionTrend";
import { calculateStats } from "./stats";

describe("internal dashboard small samples", () => {
  it.each([
    1, 2, 3, 4,
  ])("keeps statistics and trends for %i responses", (count) => {
    const items: FeedbackDto[] = Array.from({ length: count }, (_, index) => ({
      id: String(index),
      submittedAt: "2026-08-20T12:00:00Z",
      surveyId: "small-sample",
      app: "test-app",
      surveyType: "rating",
      sensitiveDataRedacted: false,
      answers: [createRatingAnswer("rating", "Vurdering", 1)],
    }));
    const params = new URLSearchParams({ surveyId: "small-sample" });
    const stats = calculateStats(items, params);
    expect(stats.totalCount).toBe(count);
    expect(stats.privacy).toBeUndefined();
    expect(stats.byRating["1"]).toBe(count);
    expect(stats.fieldStats).toHaveLength(1);
    const trend = calculateQuestionTrend(items, params, "rating", "day");
    expect(trend?.buckets).toEqual([
      expect.objectContaining({
        masked: false,
        responseCount: count,
        average: 1,
      }),
    ]);
  });

  it("keeps an empty result empty instead of masking it", () => {
    const stats = calculateStats([], new URLSearchParams());
    expect(stats.totalCount).toBe(0);
    expect(stats.privacy).toBeUndefined();
    expect(stats.fieldStats).toEqual([]);
  });
});
