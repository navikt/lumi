import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { applyDashboardSearchDefaults } from "../dashboardSearchDefaults";

describe("applyDashboardSearchDefaults", () => {
  const now = dayjs("2026-06-03");

  it("adds default 30 day period when search is empty", () => {
    const result = applyDashboardSearchDefaults(undefined, {
      now,
    });

    expect(result.changed).toBe(true);
    expect(result.search).toEqual({
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("keeps explicit date filters for deep links", () => {
    const result = applyDashboardSearchDefaults(
      {
        team: "flex",
        fromDate: "2026-01-01",
      },
      { now },
    );

    expect(result.changed).toBe(false);
    expect(result.search).toEqual({
      team: "flex",
      fromDate: "2026-01-01",
    });
  });

  it("keeps existing params while adding default period", () => {
    const result = applyDashboardSearchDefaults(
      {
        team: "team-esyfo",
        app: "lumi",
      },
      { now },
    );

    expect(result.changed).toBe(true);
    expect(result.search).toEqual({
      team: "team-esyfo",
      app: "lumi",
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("uses Europe Oslo date for server-side defaults", () => {
    const result = applyDashboardSearchDefaults(undefined, {
      now: dayjs("2026-06-02T22:30:00.000Z"),
    });

    expect(result.search).toMatchObject({
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
    });
  });
});
