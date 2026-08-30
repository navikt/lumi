import { describe, expect, it } from "vitest";
import type { FeedbackDto } from "~/types/api";
import { createMultiChoiceAnswer, createRatingAnswer } from "./helpers";
import { calculateQuestionTrend } from "./questionTrend";

function feedback(
  id: string,
  submittedAt: string,
  answer: FeedbackDto["answers"][number],
): FeedbackDto {
  return {
    id,
    submittedAt,
    app: "app-1",
    surveyId: "survey-1",
    surveyType: "custom",
    answers: [answer],
    sensitiveDataRedacted: false,
  };
}

describe("calculateQuestionTrend", () => {
  it("aggregates rating averages by Oslo calendar day", () => {
    const items = [
      feedback(
        "1",
        "2026-01-01T22:30:00Z",
        createRatingAnswer("rating-1", "Hvordan gikk det?", 3),
      ),
      feedback(
        "2",
        "2026-01-01T23:30:00Z",
        createRatingAnswer("rating-1", "Hvordan gikk det?", 5),
      ),
      ...[3, 4, 5, 6].map((value) =>
        feedback(
          String(value),
          "2026-01-02T12:00:00Z",
          createRatingAnswer("rating-1", "Hvordan gikk det?", 4),
        ),
      ),
    ];

    const result = calculateQuestionTrend(
      items,
      new URLSearchParams({ surveyId: "survey-1" }),
      "rating-1",
      "day",
    );

    expect(result?.buckets).toHaveLength(2);
    expect(result?.buckets[0]).toMatchObject({
      startDate: "2026-01-01",
      masked: true,
    });
    expect(result?.buckets[1]).toMatchObject({
      startDate: "2026-01-02",
      responseCount: 5,
      average: 4.2,
    });
  });

  it("uses distinct respondents as the multi-choice denominator", () => {
    const options = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const selections = [["a", "b", "a"], ["a", "b"], ["a"], ["b"], ["b"]];
    const items = selections.map((selected, index) =>
      feedback(
        String(index),
        "2026-02-10T12:00:00Z",
        createMultiChoiceAnswer(
          "choice-1",
          "Hva var viktig?",
          selected,
          undefined,
          options,
        ),
      ),
    );

    const result = calculateQuestionTrend(
      items,
      new URLSearchParams({ surveyId: "survey-1", app: "app-1" }),
      "choice-1",
      "month",
    );

    expect(result?.buckets[0]).toMatchObject({
      responseCount: 5,
      distribution: {
        a: { count: 3, percentage: 60 },
        b: { count: 4, percentage: 80 },
      },
    });
  });

  it("returns null for text or missing fields", () => {
    expect(
      calculateQuestionTrend([], new URLSearchParams(), "text-1", "week"),
    ).toBeNull();
  });
});
