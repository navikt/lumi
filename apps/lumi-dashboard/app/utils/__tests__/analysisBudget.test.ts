import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  isAnalysisBudgetError,
  periodDays,
  periodEnd,
  shorterPeriodDays,
} from "../analysisBudget";

const TODAY = dayjs("2026-10-22");

function apiError(type: ErrorType, status = 400) {
  return new ApiErrorException({
    status,
    type,
    message: "test error",
    timestamp: "2026-08-23T00:00:00Z",
  });
}

describe("isAnalysisBudgetError", () => {
  it("recognises the typed analysis budget error", () => {
    expect(
      isAnalysisBudgetError(apiError(ErrorType.ANALYSIS_BUDGET_EXCEEDED)),
    ).toBe(true);
  });

  it("ignores other API errors and runtime errors", () => {
    expect(isAnalysisBudgetError(apiError(ErrorType.BAD_REQUEST))).toBe(false);
    expect(isAnalysisBudgetError(new Error("network failure"))).toBe(false);
    expect(isAnalysisBudgetError(undefined)).toBe(false);
  });
});

describe("periodEnd", () => {
  it("ends the period at its end date, or today when that is later or missing", () => {
    expect(periodEnd("2026-09-30", TODAY).format("YYYY-MM-DD")).toBe(
      "2026-09-30",
    );
    expect(periodEnd("2026-12-31", TODAY).format("YYYY-MM-DD")).toBe(
      "2026-10-22",
    );
    expect(periodEnd(undefined, TODAY).format("YYYY-MM-DD")).toBe("2026-10-22");
  });
});

describe("periodDays", () => {
  it("counts the days up to the period's end", () => {
    expect(periodDays("2026-10-20", "2026-10-22", TODAY)).toBe(3);
    expect(periodDays("2026-10-20", undefined, TODAY)).toBe(3);
    expect(periodDays("2026-10-20", "2026-12-31", TODAY)).toBe(3);
  });

  it("has no limit without a start", () => {
    expect(periodDays(undefined, "2026-10-22", TODAY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("shorterPeriodDays", () => {
  it("suggests 30 days for a longer period", () => {
    expect(shorterPeriodDays("2026-07-25", "2026-10-22", TODAY)).toBe(30);
    expect(shorterPeriodDays("2026-09-22", "2026-10-22", TODAY)).toBe(30);
    expect(shorterPeriodDays(undefined, "2026-10-22", TODAY)).toBe(30);
  });

  it("suggests 7 days when the period is already 30 days or shorter", () => {
    expect(shorterPeriodDays("2026-09-23", "2026-10-22", TODAY)).toBe(7);
    expect(shorterPeriodDays("2026-10-15", "2026-10-22", TODAY)).toBe(7);
  });

  it("suggests nothing for a week or less, also without an end date", () => {
    expect(
      shorterPeriodDays("2026-10-16", "2026-10-22", TODAY),
    ).toBeUndefined();
    expect(shorterPeriodDays("2026-10-20", undefined, TODAY)).toBeUndefined();
    expect(
      shorterPeriodDays("2026-10-22", "2026-10-20", TODAY),
    ).toBeUndefined();
  });

  it("counts a period that ends in the future only up to today", () => {
    expect(
      shorterPeriodDays("2026-10-16", "2026-12-31", TODAY),
    ).toBeUndefined();
  });
});
