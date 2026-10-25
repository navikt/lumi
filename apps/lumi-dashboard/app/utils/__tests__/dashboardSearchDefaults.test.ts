import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { applyDashboardSearchDefaults } from "../dashboardSearchDefaults";

describe("applyDashboardSearchDefaults", () => {
  const now = dayjs("2026-06-03");

  describe("«Fra første svar»", () => {
    it("ends today and drops a start, keeping the page", () => {
      const result = applyDashboardSearchDefaults(
        {
          team: "flex",
          dateMode: "relative",
          periodPreset: "sinceFirst",
          fromDate: "2026-01-01",
          toDate: "2026-06-01",
          page: "3",
        },
        { now },
      );

      expect(result).toEqual({
        changed: true,
        search: {
          team: "flex",
          dateMode: "relative",
          periodPreset: "sinceFirst",
          toDate: "2026-06-03",
          page: "3",
        },
      });
    });

    it("moves to the next day in Oslo after midnight", () => {
      const result = applyDashboardSearchDefaults(
        {
          dateMode: "relative",
          periodPreset: "sinceFirst",
          toDate: "2026-06-03",
        },
        { now: dayjs("2026-06-03T22:30:00Z") },
      );

      expect(result.search.toDate).toBe("2026-06-04");
    });

    it("drops a blank start", () => {
      const result = applyDashboardSearchDefaults(
        {
          dateMode: "relative",
          periodPreset: "sinceFirst",
          fromDate: " ",
          toDate: "2026-06-03",
        },
        { now },
      );

      expect(result.changed).toBe(true);
      expect(result.search).not.toHaveProperty("fromDate");
    });

    it("leaves a link from today as it is", () => {
      const search = {
        dateMode: "relative",
        periodPreset: "sinceFirst",
        toDate: "2026-06-03",
      };

      expect(applyDashboardSearchDefaults(search, { now })).toEqual({
        search,
        changed: false,
      });
    });

    it("gives another relative period the default period", () => {
      expect(
        applyDashboardSearchDefaults(
          { dateMode: "relative", toDate: "2026-06-01" },
          { now },
        ),
      ).toEqual({
        changed: true,
        search: {
          dateMode: "auto",
          fromDate: "2026-05-05",
          toDate: "2026-06-03",
          page: "1",
        },
      });
    });

    it("drops the preset from a fixed period", () => {
      expect(
        applyDashboardSearchDefaults(
          {
            dateMode: "fixed",
            periodPreset: "sinceFirst",
            fromDate: "2026-01-01",
            toDate: "2026-02-01",
          },
          { now },
        ),
      ).toEqual({
        changed: true,
        search: {
          dateMode: "fixed",
          fromDate: "2026-01-01",
          toDate: "2026-02-01",
        },
      });
    });
  });

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
