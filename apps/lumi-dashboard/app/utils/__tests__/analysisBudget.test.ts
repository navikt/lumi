import { describe, expect, it } from "vitest";
import { analysisBudgetError } from "~/mock/analysisBudget";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  inMemoryFilters,
  isAnalysisBudgetError,
  nameFilters,
  shorterPeriod,
} from "../analysisBudget";

const TODAY = "2026-10-22";

describe("isAnalysisBudgetError", () => {
  it("recognises the typed analysis budget error", () => {
    expect(isAnalysisBudgetError(analysisBudgetError())).toBe(true);
  });

  it("ignores other API errors and runtime errors", () => {
    const badRequest = new ApiErrorException({
      status: 400,
      type: ErrorType.BAD_REQUEST,
      message: "test error",
      timestamp: "2026-08-23T00:00:00Z",
    });

    expect(isAnalysisBudgetError(badRequest)).toBe(false);
    expect(isAnalysisBudgetError(new Error("network failure"))).toBe(false);
    expect(isAnalysisBudgetError(undefined)).toBe(false);
  });
});

describe("shorterPeriod", () => {
  it("suggests the last 30 days of a longer period", () => {
    expect(
      shorterPeriod({ fromDate: "2026-07-25", toDate: "2026-10-22" }, TODAY),
    ).toEqual({ fromDate: "2026-09-23", toDate: "2026-10-22" });
    expect(shorterPeriod({ toDate: "2026-10-22" }, TODAY)).toEqual({
      fromDate: "2026-09-23",
      toDate: "2026-10-22",
    });
  });

  it("suggests the last 7 days when the period is 30 days or shorter", () => {
    expect(
      shorterPeriod({ fromDate: "2026-09-23", toDate: "2026-10-22" }, TODAY),
    ).toEqual({ fromDate: "2026-10-16", toDate: "2026-10-22" });
  });

  it("suggests nothing for a week or less, also without an end date", () => {
    expect(
      shorterPeriod({ fromDate: "2026-10-16", toDate: "2026-10-22" }, TODAY),
    ).toBeUndefined();
    expect(shorterPeriod({ fromDate: "2026-10-20" }, TODAY)).toBeUndefined();
    expect(
      shorterPeriod({ fromDate: "2026-10-22", toDate: "2026-10-20" }, TODAY),
    ).toBeUndefined();
  });

  it("counts a period that ends in the future only up to today", () => {
    expect(
      shorterPeriod({ fromDate: "2026-10-16", toDate: "2026-12-31" }, TODAY),
    ).toBeUndefined();
    expect(
      shorterPeriod({ fromDate: "2026-07-25", toDate: "2026-12-31" }, TODAY),
    ).toEqual({ fromDate: "2026-09-23", toDate: "2026-10-22" });
  });

  it("keeps the suggestion inside a period that ended before today", () => {
    expect(
      shorterPeriod({ fromDate: "2026-06-01", toDate: "2026-08-15" }, TODAY),
    ).toEqual({ fromDate: "2026-07-17", toDate: "2026-08-15" });
  });

  it("ends the suggestion at the last answer", () => {
    expect(
      shorterPeriod({ fromDate: "2026-01-01", toDate: "2026-10-22" }, TODAY, {
        fromDate: "2026-01-05",
        toDate: "2026-06-30",
      }),
    ).toEqual({ fromDate: "2026-06-01", toDate: "2026-06-30" });
  });

  it("chooses 7 days when the answers start less than 30 days before the end", () => {
    expect(
      shorterPeriod({ fromDate: "2026-07-25", toDate: "2026-10-22" }, TODAY, {
        fromDate: "2026-10-03",
        toDate: "2026-10-22",
      }),
    ).toEqual({ fromDate: "2026-10-16", toDate: "2026-10-22" });
  });

  it("suggests nothing when the answers span a week or less", () => {
    expect(
      shorterPeriod({ fromDate: "2026-07-25", toDate: "2026-10-22" }, TODAY, {
        fromDate: "2026-10-20",
        toDate: "2026-10-22",
      }),
    ).toBeUndefined();
  });

  it("starts the span at the first answer when the period has no start", () => {
    expect(
      shorterPeriod({ toDate: "2026-10-22" }, TODAY, {
        fromDate: "2026-10-10",
        toDate: "2026-10-22",
      }),
    ).toEqual({ fromDate: "2026-10-16", toDate: "2026-10-22" });
  });

  it("keeps the period when the answer span is out of date", () => {
    expect(
      shorterPeriod({ fromDate: "2026-07-25", toDate: "2026-10-22" }, TODAY, {
        fromDate: "2026-01-05",
        toDate: "2026-06-30",
      }),
    ).toEqual({ fromDate: "2026-09-23", toDate: "2026-10-22" });
  });
});

describe("inMemoryFilters", () => {
  it("lists the task, theme and phrase filters that are set", () => {
    expect(inMemoryFilters({ task: "a", phrase: "field:to ord" })).toEqual([
      "task",
      "phrase",
    ]);
  });

  it("ignores values with only spaces, like the API", () => {
    expect(inMemoryFilters({ task: " ", theme: "  " })).toEqual([]);
  });
});

describe("nameFilters", () => {
  it("names the filters to remove", () => {
    expect(nameFilters(["task"])).toBe("filteret på oppgave");
    expect(nameFilters(["task", "phrase"])).toBe(
      "filtrene på oppgave og uttrykk",
    );
    expect(nameFilters(["task", "theme", "phrase"])).toBe(
      "filtrene på oppgave, tema og uttrykk",
    );
  });
});

describe("shorterPeriod with dates that do not exist", () => {
  it("treats an invalid start as no start, as the API does", () => {
    expect(
      shorterPeriod({ fromDate: "2026-09-31", toDate: TODAY }, TODAY),
    ).toEqual({ fromDate: "2026-09-23", toDate: TODAY });
  });
});

describe("shorterPeriod at the edges of 30 and 7 days", () => {
  it("offers 30 days for 31 days, 7 days for 8 days and nothing for 7 days", () => {
    expect(
      shorterPeriod({ fromDate: "2026-09-22", toDate: TODAY }, TODAY),
    ).toEqual({ fromDate: "2026-09-23", toDate: TODAY });
    expect(
      shorterPeriod({ fromDate: "2026-10-15", toDate: TODAY }, TODAY),
    ).toEqual({ fromDate: "2026-10-16", toDate: TODAY });
    expect(
      shorterPeriod({ fromDate: "2026-10-16", toDate: TODAY }, TODAY),
    ).toBeUndefined();
  });
});
