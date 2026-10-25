import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackDto } from "~/types/api";
import { createRatingAnswer } from "./helpers";
import { calculateStats } from "./stats";

function answer(id: string, submittedAt: string): FeedbackDto {
  return {
    id,
    submittedAt,
    surveyId: "period-survey",
    app: "test-app",
    surveyType: "rating",
    sensitiveDataRedacted: false,
    answers: [createRatingAnswer("rating", "Vurdering", 4)],
  };
}

const items = [
  answer("old", "2026-08-01T12:00:00Z"),
  answer("recent", "2026-10-20T12:00:00Z"),
];

describe("mock statistics period", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("echoes the dates that were asked for, as the API does", () => {
    const stats = calculateStats(
      items,
      new URLSearchParams({ surveyId: "period-survey", toDate: "2026-09-19" }),
    );

    expect(stats.period).toEqual({
      fromDate: null,
      toDate: "2026-09-19",
      days: 30,
    });
    expect(stats.byDate).toEqual({ "2026-08-01": 1 });
  });

  it("counts the days of the last 30 days only without a period", () => {
    const stats = calculateStats(
      items,
      new URLSearchParams({ surveyId: "period-survey" }),
    );

    expect(stats.period).toEqual({ fromDate: null, toDate: null, days: 30 });
    expect(stats.totalCount).toBe(2);
    expect(stats.byDate).toEqual({ "2026-10-20": 1 });
  });
});
