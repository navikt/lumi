import { describe, expect, it } from "vitest";
import type { QuestionTrendResponse } from "~/types/api";
import {
  fillQuestionTrendBuckets,
  formatQuestionTrendBucket,
  questionTrendChartData,
  questionTrendChoiceValue,
  questionTrendRatingMetric,
  questionTrendRatingValue,
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

describe("rating trend semantics", () => {
  it("keeps period labels separate from arbitrary choice identifiers", () => {
    const data = questionTrendChartData(
      {
        ...trend,
        fieldType: "SINGLE_CHOICE",
        options: [
          { id: "label", label: "Etikett" },
          { id: "values.0", label: "Verdi" },
        ],
      },
      [
        {
          ...trend.buckets[0],
          distribution: {
            label: { count: 3, percentage: 60 },
            "values.0": { count: 2, percentage: 40 },
          },
        },
      ],
      "percentage",
    );
    expect(data[0]).toMatchObject({
      label: "Uke 2 · 05.01–11.01",
      values: [60, 40],
    });
  });
  it("distinguishes no respondents from a measured zero share", () => {
    const empty = { ...trend.buckets[0], responseCount: 0, distribution: {} };
    expect(questionTrendChoiceValue(empty, "a", "percentage")).toBeNull();
    expect(questionTrendChoiceValue(empty, "a", "count")).toBe(0);
    expect(
      questionTrendChoiceValue(
        { ...empty, responseCount: 5 },
        "a",
        "percentage",
      ),
    ).toBe(0);
  });
  it("computes NPS from the full distribution, not its arithmetic average", () => {
    const contract = { ratingVariant: "nps" as const, ratingScale: 11 };
    expect(questionTrendRatingMetric(contract)).toMatchObject({
      label: "NPS",
      domain: [-100, 100],
    });
    expect(
      questionTrendRatingValue(contract, {
        ...trend.buckets[0],
        average: 6,
        responseCount: 5,
        ratingDistribution: { "3": 2, "8": 1, "10": 2 },
      }),
    ).toBe(0);
  });
  it("computes the positive share for thumbs", () => {
    const contract = { ratingVariant: "thumbs" as const, ratingScale: 2 };
    expect(
      questionTrendRatingValue(contract, {
        ...trend.buckets[0],
        average: 1.6,
        responseCount: 5,
        ratingDistribution: { "1": 2, "2": 3 },
      }),
    ).toBe(60);
  });
  it("preserves a null gap when a semantic metric lacks distributions or answers", () => {
    expect(
      questionTrendRatingValue({ ratingVariant: "nps" }, trend.buckets[0]),
    ).toBeNull();
    expect(
      questionTrendRatingValue(
        { ratingVariant: "emoji" },
        { ...trend.buckets[0], responseCount: 0, average: 0 },
      ),
    ).toBeNull();
    expect(
      questionTrendRatingValue(
        { ratingVariant: "emoji" },
        { ...trend.buckets[0], masked: true },
      ),
    ).toBeNull();
  });
  it("does not invent a scale for historical ratings without metadata", () => {
    expect(questionTrendRatingMetric({})).toMatchObject({
      variant: "unknown",
      label: "Gjennomsnitt",
      domain: ["auto", "auto"],
    });
    expect(questionTrendRatingValue({}, trend.buckets[0])).toBe(4);
  });
});

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
