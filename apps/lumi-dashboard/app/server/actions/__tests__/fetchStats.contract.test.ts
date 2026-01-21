import { describe, expect, it } from "vitest";

import { FeedbackStatsSchema } from "~/types/schemas";
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
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      segment: "k:v,,x:y",
      task: "task-123",
    });

    expect(params).toEqual({
      team: "team-1",
      app: "app-1",
      surveyId: "survey-1",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      deviceType: "mobile",
      segment: ["k:v", "x:y"],
      task: "task-123",
    });
  });

  it("builds a URL with repeated segment params", () => {
    const url = buildStatsDashboardUrl("https://backend.example", {
      team: "team-1",
      segment: "a:b,,c:d",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe(STATS_DASHBOARD_PATH);
    expect(parsed.searchParams.get("team")).toBe("team-1");
    expect(parsed.searchParams.getAll("segment")).toEqual(["a:b", "c:d"]);
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
});
