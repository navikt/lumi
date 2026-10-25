import { describe, expect, it } from "vitest";
import type { QuestionTrendResponse } from "~/types/api";
import { buildTimeAxis } from "~/utils/timeBuckets";
import {
  inSentence,
  questionPointHasValue,
  questionSeries,
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
    const choiceTrend = {
      ...trend,
      fieldType: "SINGLE_CHOICE" as const,
      options: [
        { id: "label", label: "Etikett" },
        { id: "values.0", label: "Verdi" },
      ],
      buckets: [
        {
          ...trend.buckets[0],
          startDate: "2026-01-05",
          masked: false,
          distribution: {
            label: { count: 3, percentage: 60 },
            "values.0": { count: 2, percentage: 40 },
          },
        },
      ],
    };
    const series = questionSeries(
      buildTimeAxis({ from: "2026-01-05", to: "2026-01-11" }, "week"),
      choiceTrend,
    );
    const data = questionTrendChartData(
      choiceTrend,
      series.points,
      "percentage",
    );
    expect(data[0]).toMatchObject({
      label: "Uke 2, 2026 · 05.01–11.01",
      tick: "05.01",
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
    const series = questionSeries(
      buildTimeAxis({ from: "2026-01-07", to: "2026-01-25" }, "week"),
      trend,
    );

    expect(series.points.map((point) => point.start)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
    expect(series.points[1]?.bucket).toMatchObject({
      masked: false,
      responseCount: 0,
    });
    expect(series.points[2]?.bucket.masked).toBe(true);
    expect(series.points[0]).toMatchObject({
      partial: true,
      label: "Uke 2, 2026 · 07.01–11.01 (5 av 7 dager)",
    });
  });

  it("draws a point for a bucket without answers only when the chart shows counts", () => {
    const choiceTrend = {
      ...trend,
      fieldType: "SINGLE_CHOICE" as const,
      options: [{ id: "a", label: "A" }],
    };
    const empty = {
      startDate: "2026-01-12",
      masked: false,
      responseCount: 0,
      distribution: { a: { count: 0, percentage: 0 } },
    };

    expect(questionPointHasValue(choiceTrend, empty, "count")).toBe(true);
    expect(questionPointHasValue(choiceTrend, empty, "percentage")).toBe(false);
    expect(questionPointHasValue(trend, empty, "count")).toBe(false);
  });

  it("writes metric names in lower case in a sentence, except names in capitals", () => {
    expect(inSentence("Gjennomsnitt")).toBe("gjennomsnitt");
    expect(inSentence("NPS")).toBe("NPS");
  });
});
