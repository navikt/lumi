import { describe, expect, it } from "vitest";
import {
  QuestionTrendParamsSchema,
  QuestionTrendResponseSchema,
} from "~/types/schemas";
import {
  buildQuestionTrendUrl,
  QUESTION_TREND_PATH,
} from "../fetchQuestionTrend";

describe("fetchQuestionTrend contract", () => {
  it("targets the additive trend endpoint with all active filters", () => {
    const url = new URL(
      buildQuestionTrendUrl("https://backend.example", {
        team: "team-1",
        includeArchived: "true",
        app: "app-1",
        surveyId: "survey-1",
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
        deviceType: "mobile",
        segment: "group:a,role:b",
        task: "task-1",
        rating: ["rating-1:5"],
        choice: ["choice-1:a"],
        fieldId: "choice-2",
        interval: "week",
      }),
    );

    expect(url.pathname).toBe(QUESTION_TREND_PATH);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      team: "team-1",
      includeArchived: "true",
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      task: "task-1",
      fieldId: "choice-2",
      interval: "week",
    });
    expect(url.searchParams.getAll("segment")).toEqual(["group:a", "role:b"]);
    expect(url.searchParams.getAll("rating")).toEqual(["rating-1:5"]);
    expect(url.searchParams.getAll("choice")).toEqual(["choice-1:a"]);
  });

  it("requires one survey and a safe field id", () => {
    expect(() =>
      QuestionTrendParamsSchema.parse({ fieldId: "rating-1", interval: "day" }),
    ).toThrow();
    expect(() =>
      QuestionTrendParamsSchema.parse({
        surveyId: "survey-1",
        fieldId: "rating.unsafe",
        interval: "day",
      }),
    ).toThrow();
  });

  it("validates masked and visible buckets", () => {
    const response = QuestionTrendResponseSchema.parse({
      fieldId: "choice-1",
      fieldType: "MULTI_CHOICE",
      label: "Hva var viktig?",
      interval: "month",
      privacyThreshold: 5,
      options: [{ id: "a", label: "Alternativ A" }],
      buckets: [
        {
          startDate: "2026-01-01",
          masked: true,
          responseCount: null,
          average: null,
          distribution: {},
        },
        {
          startDate: "2026-02-01",
          masked: false,
          responseCount: 5,
          distribution: { a: { count: 3, percentage: 60 } },
        },
      ],
    });

    expect(response.buckets[0]?.responseCount).toBeNull();
    expect(response.buckets[1]?.distribution.a?.percentage).toBe(60);
  });
});
