import { describe, expect, it } from "vitest";
import { FieldTrendResponseSchema } from "~/types/schemas";
import { buildFieldTrendUrl, FIELD_TREND_PATH } from "../fetchFieldTrend";

describe("fetchFieldTrend contract", () => {
  it("targets the dedicated endpoint with active dashboard filters", () => {
    const url = buildFieldTrendUrl("https://backend.example", {
      team: "team-1",
      includeArchived: "true",
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      segment: "a:b,,c:d",
      task: "task-1",
      rating: ["rating-1:5"],
      choice: ["choice-1:yes"],
      fieldId: "choice-1",
      granularity: "month",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe(FIELD_TREND_PATH);
    expect(parsed.searchParams.getAll("segment")).toEqual(["a:b", "c:d"]);
    expect(parsed.searchParams.getAll("rating")).toEqual(["rating-1:5"]);
    expect(parsed.searchParams.getAll("choice")).toEqual(["choice-1:yes"]);
    expect(parsed.searchParams.get("fieldId")).toBe("choice-1");
    expect(parsed.searchParams.get("granularity")).toBe("month");
  });

  it("accepts definition metadata and distinct empty and masked points", () => {
    expect(() =>
      FieldTrendResponseSchema.parse({
        fields: [
          {
            fieldId: "opplevelse",
            fieldType: "RATING",
            label: "Hvordan var opplevelsen?",
            options: [],
            ratingVariant: "nps",
            ratingScale: 11,
            ratingMin: 0,
            ratingMax: 10,
          },
        ],
        trend: {
          fieldId: "opplevelse",
          granularity: "week",
          points: [
            {
              periodStart: "2026-01-05",
              responseCount: 0,
              average: null,
              distribution: {},
              masked: false,
              empty: true,
            },
            {
              periodStart: "2026-01-12",
              responseCount: null,
              average: null,
              distribution: {},
              masked: true,
              empty: false,
            },
          ],
        },
        privacyThreshold: 5,
      }),
    ).not.toThrow();
  });
});
