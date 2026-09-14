import { describe, expect, it } from "vitest";
import type { FeedbackDto } from "~/types/api";
import { createMultiChoiceAnswer, createRatingAnswer } from "../helpers";
import { calculateStats } from "../stats";

const item: FeedbackDto = {
  id: "one",
  app: "app-a",
  surveyId: "survey-a",
  surveyType: "custom",
  submittedAt: "2026-09-01T12:00:00Z",
  sensitiveDataRedacted: false,
  answers: [
    createRatingAnswer("rating", "Vurdering", 1, undefined, "emoji", 5),
    createMultiChoiceAnswer("role", "Rolle", ["a", "a"], undefined, [
      { id: "a", label: "Privatperson" },
      { id: "b", label: "Arbeidsgiver" },
    ]),
  ],
};

describe("statistics field catalog", () => {
  it("retains zero-answer fields and choices outside response dates", () => {
    const stats = calculateStats(
      [item],
      new URLSearchParams({ surveyId: "survey-a", fromDate: "2026-09-02" }),
    );
    expect(stats.totalCount).toBe(0);
    expect(stats.surveyType).toBe("custom");
    expect(stats.fieldStats).toHaveLength(2);
    expect(stats.fieldStats[0].stats).toMatchObject({
      ratingVariant: "emoji",
      ratingScale: 5,
      distribution: { "1": 0, "5": 0 },
    });
    expect(stats.fieldStats[1].stats).toMatchObject({
      responseCount: 0,
      distribution: {
        a: { count: 0, label: "Privatperson" },
        b: { count: 0, label: "Arbeidsgiver" },
      },
    });
  });

  it("does not leak the catalog across app or survey scopes", () => {
    for (const params of ["app=app-b", "surveyId=survey-b"]) {
      expect(
        calculateStats([item], new URLSearchParams(params)).fieldStats,
      ).toEqual([]);
    }
  });

  it("counts a respondent once per choice and does not infer thumbs from low ratings", () => {
    const stats = calculateStats(
      [item],
      new URLSearchParams({ surveyId: "survey-a" }),
    );
    expect(stats.fieldStats[0].stats).toMatchObject({
      ratingVariant: "emoji",
      ratingScale: 5,
    });
    expect(stats.fieldStats[1].stats).toMatchObject({
      responseCount: 1,
      distribution: { a: { count: 1, percentage: 100 } },
    });
  });
});
