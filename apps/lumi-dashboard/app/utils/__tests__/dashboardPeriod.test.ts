import { describe, expect, it } from "vitest";
import {
  fixedPeriodSearch,
  getAnswerSpan,
  getTeamSubmissionPeriod,
  isSinceFirst,
  resolveDashboardPeriod,
  sinceFirstSearch,
} from "../dashboardPeriod";

describe("resolveDashboardPeriod", () => {
  it("uses a rolling 30-day period in auto mode when no survey is selected", () => {
    expect(
      resolveDashboardPeriod({
        now: new Date("2026-08-21T10:00:00Z"),
      }),
    ).toMatchObject({
      dateMode: "auto",
      fromDate: "2026-07-23",
      toDate: "2026-08-21",
    });
  });

  it("keeps «Fra første svar» as it is, without a start", () => {
    expect(
      resolveDashboardPeriod({
        dateMode: "relative",
        toDate: "2026-08-20",
        surveyMeta: {
          firstSubmissionAt: "2026-01-02T10:00:00Z",
          lastSubmissionAt: "2026-08-01T10:00:00Z",
        },
      }),
    ).toEqual({ dateMode: "relative", toDate: "2026-08-20" });
  });

  it("treats legacy URLs with explicit dates as fixed periods", () => {
    expect(
      resolveDashboardPeriod({
        fromDate: "2024-02-01",
        toDate: "2024-02-18",
        now: new Date("2026-08-21T10:00:00Z"),
      }),
    ).toMatchObject({
      dateMode: "fixed",
      fromDate: "2024-02-01",
      toDate: "2024-02-18",
    });
  });

  it("falls back to a bounded automatic period when fixed mode has no dates", () => {
    expect(
      resolveDashboardPeriod({
        dateMode: "fixed",
        now: new Date("2026-08-21T10:00:00Z"),
      }),
    ).toMatchObject({
      dateMode: "auto",
      fromDate: "2026-07-23",
      toDate: "2026-08-21",
    });
  });

  it("anchors an automatic survey period on its newest response", () => {
    expect(
      resolveDashboardPeriod({
        dateMode: "auto",
        fromDate: "2026-07-23",
        toDate: "2026-08-21",
        surveyMeta: {
          firstSubmissionAt: "2024-01-01T12:00:00Z",
          lastSubmissionAt: "2024-02-18T12:00:00Z",
        },
        now: new Date("2026-08-21T10:00:00Z"),
      }),
    ).toMatchObject({
      dateMode: "auto",
      fromDate: "2024-01-20",
      toDate: "2024-02-18",
    });
  });

  it("does not start an automatic period before the survey's first response", () => {
    expect(
      resolveDashboardPeriod({
        dateMode: "auto",
        surveyMeta: {
          firstSubmissionAt: "2024-02-10T23:30:00Z",
          lastSubmissionAt: "2024-02-18T12:00:00Z",
        },
      }),
    ).toMatchObject({
      fromDate: "2024-02-11",
      toDate: "2024-02-18",
    });
  });

  it("preserves a fixed period and reports when it misses the survey's response period", () => {
    expect(
      resolveDashboardPeriod({
        dateMode: "fixed",
        fromDate: "2026-08-01",
        toDate: "2026-08-21",
        surveyMeta: {
          firstSubmissionAt: "2024-02-10T12:00:00Z",
          lastSubmissionAt: "2024-02-18T12:00:00Z",
        },
      }),
    ).toEqual({
      dateMode: "fixed",
      fromDate: "2026-08-01",
      toDate: "2026-08-21",
      surveyPeriod: {
        fromDate: "2024-02-10",
        toDate: "2024-02-18",
      },
      isOutsideSurveyPeriod: true,
    });
  });
});

describe("getTeamSubmissionPeriod", () => {
  const surveyMeta = {
    active: {
      archivedAt: null,
      firstSubmissionAt: "2026-02-01T12:00:00Z",
      lastSubmissionAt: "2026-02-10T12:00:00Z",
    },
    archived: {
      archivedAt: "2026-03-02T12:00:00Z",
      firstSubmissionAt: "2026-01-01T12:00:00Z",
      lastSubmissionAt: "2026-03-01T12:00:00Z",
    },
  };

  it("uses only surveys visible under the default archive filter", () => {
    expect(getTeamSubmissionPeriod(surveyMeta)).toEqual({
      fromDate: "2026-02-01",
      toDate: "2026-02-10",
    });
  });

  it("skips a submission time that is not a date", () => {
    expect(
      getTeamSubmissionPeriod({
        broken: { firstSubmissionAt: "nonsense", lastSubmissionAt: "nonsense" },
        valid: {
          firstSubmissionAt: "2026-03-01T09:00:00Z",
          lastSubmissionAt: "2026-03-05T09:00:00Z",
        },
      }),
    ).toEqual({ fromDate: "2026-03-01", toDate: "2026-03-05" });
  });

  it("includes archived surveys when they are visible", () => {
    expect(
      getTeamSubmissionPeriod(surveyMeta, { includeArchived: true }),
    ).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-03-01",
    });
  });
});

describe("getAnswerSpan", () => {
  const bootstrap = {
    surveyMeta: {
      shared: {
        archivedAt: null,
        firstSubmissionAt: "2021-04-01T09:00:00Z",
        lastSubmissionAt: "2026-06-30T22:30:00Z",
      },
      other: {
        archivedAt: null,
        firstSubmissionAt: "2026-08-01T09:00:00Z",
        lastSubmissionAt: "2026-10-01T09:00:00Z",
      },
      archived: {
        archivedAt: "2026-10-02T09:00:00Z",
        firstSubmissionAt: "2020-01-01T09:00:00Z",
        lastSubmissionAt: "2026-10-20T09:00:00Z",
      },
    },
    surveyMetaByApp: {
      "older-app": {
        shared: {
          archivedAt: null,
          firstSubmissionAt: "2021-04-01T09:00:00Z",
          lastSubmissionAt: "2021-04-06T09:00:00Z",
        },
      },
    },
  };

  it("uses the selected survey's days in Oslo", () => {
    expect(getAnswerSpan(bootstrap, { surveyId: "shared" })).toEqual({
      fromDate: "2021-04-01",
      toDate: "2026-07-01",
    });
  });

  it("uses the selected app's own days for a survey in several apps", () => {
    expect(
      getAnswerSpan(bootstrap, { surveyId: "shared", app: "older-app" }),
    ).toEqual({ fromDate: "2021-04-01", toDate: "2021-04-06" });
  });

  it("never takes the days from other apps", () => {
    // The survey has answers, but not in the selected app.
    expect(
      getAnswerSpan(bootstrap, { surveyId: "other", app: "older-app" }),
    ).toBeUndefined();
    expect(getAnswerSpan(bootstrap, { app: "app-without-answers" })).toBe(
      undefined,
    );
  });

  it("uses the selected app's surveys without a selected survey", () => {
    expect(getAnswerSpan(bootstrap, { app: "older-app" })).toEqual({
      fromDate: "2021-04-01",
      toDate: "2021-04-06",
    });
  });

  it("uses the team's visible surveys without a selected survey or app", () => {
    expect(getAnswerSpan(bootstrap, {})).toEqual({
      fromDate: "2021-04-01",
      toDate: "2026-10-01",
    });
    expect(getAnswerSpan(bootstrap, { includeArchived: true })).toEqual({
      fromDate: "2020-01-01",
      toDate: "2026-10-20",
    });
  });

  it("has no span before the bootstrap has loaded", () => {
    expect(getAnswerSpan(undefined, { surveyId: "shared" })).toBeUndefined();
    expect(getAnswerSpan(undefined, {})).toBeUndefined();
  });
});

describe("sinceFirstSearch", () => {
  it("has no start and ends today", () => {
    const search = sinceFirstSearch("2026-10-25");

    expect(search).toEqual({
      dateMode: "relative",
      periodPreset: "sinceFirst",
      toDate: "2026-10-25",
      page: "1",
    });
    // setParams removes a start that is in the address.
    expect(search).toHaveProperty("fromDate", undefined);
    expect(isSinceFirst(search)).toBe(true);
  });

  it("needs both the relative mode and the preset", () => {
    expect(
      isSinceFirst({ dateMode: "fixed", periodPreset: "sinceFirst" }),
    ).toBe(false);
    expect(isSinceFirst({ dateMode: "relative" })).toBe(false);
  });
});

describe("fixedPeriodSearch", () => {
  it("chooses a fixed period from the first page and clears the preset", () => {
    const search = fixedPeriodSearch("2026-06-01", "2026-06-30");

    expect(search).toEqual({
      dateMode: "fixed",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      page: "1",
    });
    expect(search).toHaveProperty("periodPreset", undefined);
  });
});
