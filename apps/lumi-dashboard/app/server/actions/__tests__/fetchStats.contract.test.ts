import { describe, expect, it } from "vitest";

import { DiscoveryResponseSchema, FeedbackStatsSchema } from "~/types/schemas";
import {
  buildStatsDashboardUrl,
  STATS_DASHBOARD_PATH,
  transformStatsToBackendParams,
} from "../fetchStats";

describe("fetchStats contract", () => {
  it("targets the canonical dashboard endpoint", () => {
    expect(STATS_DASHBOARD_PATH).toBe("/api/v1/intern/stats/dashboard");
  });

  it("maps dashboard filters to backend query params", () => {
    const params = transformStatsToBackendParams({
      team: "team-1",
      includeArchived: "true",
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      segment: "k:v,,x:y",
      task: "task-123",
      rating: ["rating-1:5", "thumbs-1:2"],
      choice: ["choice-1:opt-a", "choice-2:opt-b"],
    });

    expect(params).toEqual({
      team: "team-1",
      includeArchived: "true",
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      segment: ["k:v", "x:y"],
      task: "task-123",
      rating: ["rating-1:5", "thumbs-1:2"],
      choice: ["choice-1:opt-a", "choice-2:opt-b"],
    });
  });

  it("builds a URL with repeated segment, rating and choice params", () => {
    const url = buildStatsDashboardUrl("https://backend.example", {
      team: "team-1",
      includeArchived: "true",
      segment: "a:b,,c:d",
      rating: ["rating-1:5", "thumbs-1:2"],
      choice: ["choice-1:opt-a", "choice-2:opt-b"],
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe(STATS_DASHBOARD_PATH);
    expect(parsed.searchParams.get("team")).toBe("team-1");
    expect(parsed.searchParams.get("includeArchived")).toBe("true");
    expect(parsed.searchParams.getAll("segment")).toEqual(["a:b", "c:d"]);
    expect(parsed.searchParams.getAll("rating")).toEqual([
      "rating-1:5",
      "thumbs-1:2",
    ]);
    expect(parsed.searchParams.getAll("choice")).toEqual([
      "choice-1:opt-a",
      "choice-2:opt-b",
    ]);
  });

  it("accepts real-world dashboard payload shape (incl. privacy)", () => {
    const payload = {
      totalCount: 10,
      countWithText: 4,
      countWithoutText: 6,
      byRating: { "1": 1, "2": 2, "3": 3, "4": 2, "5": 2 },
      byApp: { "app-1": 10 },
      byDate: { "2026-01-21": 10 },
      bySurveyId: { "survey-1": 10 },
      averageRating: 3.2,
      ratingByDate: {
        "2026-01-21": { average: 3.2, count: 10 },
      },
      byDevice: { mobile: { count: 10, averageRating: 3.2 } },
      byPathname: { "/": { count: 10, averageRating: 3.2 } },
      lowestRatingPaths: {},
      fieldStats: [],
      surveyType: "rating",
      period: { fromDate: "2026-01-01", toDate: "2026-01-21", days: 21 },
      privacy: { masked: false, threshold: 5 },
    };

    expect(() => FeedbackStatsSchema.parse(payload)).not.toThrow();
  });

  it("accepts TextStats field with topPhrases", () => {
    const payload = {
      totalCount: 10,
      countWithText: 4,
      countWithoutText: 6,
      byRating: { "1": 1, "2": 2, "3": 3, "4": 2, "5": 2 },
      byApp: { "app-1": 10 },
      byDate: { "2026-01-21": 10 },
      bySurveyId: { "survey-1": 10 },
      averageRating: 3.2,
      ratingByDate: {
        "2026-01-21": { average: 3.2, count: 10 },
      },
      byDevice: { mobile: { count: 10, averageRating: 3.2 } },
      byPathname: { "/": { count: 10, averageRating: 3.2 } },
      lowestRatingPaths: {},
      fieldStats: [
        {
          fieldId: "text-1",
          fieldType: "TEXT",
          label: "Hva synes du?",
          stats: {
            type: "text",
            responseCount: 4,
            responseRate: 0.4,
            topKeywords: [{ word: "vanskelig", count: 3 }],
            recentResponses: [
              { text: "Alt var bra", submittedAt: "2026-01-21T10:00:00Z" },
            ],
            topPhrases: [{ text: "vanskelig forstå", count: 5 }],
          },
        },
      ],
      surveyType: "rating",
      period: { fromDate: "2026-01-01", toDate: "2026-01-21", days: 21 },
      privacy: { masked: false, threshold: 5 },
    };

    const parsed = FeedbackStatsSchema.parse(payload);
    const textField = parsed.fieldStats[0]?.stats;
    expect(textField).toBeDefined();
    if (textField?.type === "text") {
      expect(textField.topPhrases).toEqual([
        { text: "vanskelig forstå", count: 5 },
      ]);
    }
  });

  it("accepts TextStats field without topPhrases (backwards-compat)", () => {
    const payload = {
      totalCount: 5,
      countWithText: 2,
      countWithoutText: 3,
      byRating: {},
      byApp: {},
      byDate: {},
      bySurveyId: {},
      averageRating: null,
      ratingByDate: {},
      byDevice: {},
      byPathname: {},
      lowestRatingPaths: {},
      fieldStats: [
        {
          fieldId: "text-1",
          fieldType: "TEXT",
          label: "Kommentar",
          stats: {
            type: "text",
            responseCount: 2,
            responseRate: 0.4,
            topKeywords: [],
            recentResponses: [],
          },
        },
      ],
      period: { fromDate: null, toDate: null, days: 0 },
    };

    const parsed = FeedbackStatsSchema.parse(payload);
    const textField = parsed.fieldStats[0]?.stats;
    expect(textField).toBeDefined();
    if (textField?.type === "text") {
      expect(textField.topPhrases).toBeUndefined();
    }
  });

  it("accepts PhraseEntry without sourceResponseIds (backwards-compat)", () => {
    const discoveryPayload = {
      totalSubmissions: 10,
      wordFrequency: [],
      themes: [],
      recentResponses: [],
      phrases: [
        { text: "vanskelig svare", count: 8 },
        { text: "greie spørsmål", count: 4, sourceResponseIds: ["id-1"] },
      ],
    };

    const parsed = DiscoveryResponseSchema.parse(discoveryPayload);
    expect(parsed.phrases?.[0]?.sourceResponseIds).toBeUndefined();
    expect(parsed.phrases?.[1]?.sourceResponseIds).toEqual(["id-1"]);
  });
});
