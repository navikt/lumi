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
      dateMode: "auto",
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("marks legacy deep links with explicit dates as fixed", () => {
    const result = applyDashboardSearchDefaults(
      {
        team: "flex",
        fromDate: "2026-01-01",
      },
      { now },
    );

    expect(result.changed).toBe(true);
    expect(result.search).toEqual({
      team: "flex",
      dateMode: "fixed",
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
      dateMode: "auto",
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("replaces a partial automatic range with two bounded dates", () => {
    const result = applyDashboardSearchDefaults(
      {
        dateMode: "auto",
        fromDate: "2024-01-01",
      },
      { now },
    );

    expect(result.changed).toBe(true);
    expect(result.search).toEqual({
      dateMode: "auto",
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("refreshes a stale automatic range when no survey is selected", () => {
    const result = applyDashboardSearchDefaults(
      {
        dateMode: "auto",
        fromDate: "2024-01-01",
        toDate: "2024-01-30",
      },
      { now },
    );

    expect(result.changed).toBe(true);
    expect(result.search).toEqual({
      dateMode: "auto",
      fromDate: "2026-05-05",
      toDate: "2026-06-03",
      page: "1",
    });
  });

  it("keeps today's automatic range stable", () => {
    const result = applyDashboardSearchDefaults(
      {
        dateMode: "auto",
        fromDate: "2026-05-05",
        toDate: "2026-06-03",
      },
      { now },
    );

    expect(result.changed).toBe(false);
  });

  it("leaves a complete automatic survey range for bootstrap metadata to resolve", () => {
    const search = {
      surveyId: "historisk-survey",
      dateMode: "auto",
      fromDate: "2024-01-20",
      toDate: "2024-02-18",
    };

    const result = applyDashboardSearchDefaults(search, { now });

    expect(result).toEqual({ search, changed: false });
  });

  it("normalizes fixed mode without dates to a bounded automatic range", () => {
    const result = applyDashboardSearchDefaults(
      {
        dateMode: "fixed",
      },
      { now },
    );

    expect(result.search).toEqual({
      dateMode: "auto",
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
