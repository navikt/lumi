import { describe, expect, it } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { isAnalysisBudgetError, shorterPeriodDays } from "../analysisBudget";

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

  it("ignores other API errors, other statuses and runtime errors", () => {
    expect(isAnalysisBudgetError(apiError(ErrorType.BAD_REQUEST))).toBe(false);
    expect(
      isAnalysisBudgetError(apiError(ErrorType.ANALYSIS_BUDGET_EXCEEDED, 500)),
    ).toBe(false);
    expect(isAnalysisBudgetError(new Error("network failure"))).toBe(false);
    expect(isAnalysisBudgetError(undefined)).toBe(false);
  });
});

describe("shorterPeriodDays", () => {
  it("suggests 30 days for a longer period", () => {
    expect(shorterPeriodDays("2026-07-25", "2026-10-22")).toBe(30);
    expect(shorterPeriodDays("2026-09-22", "2026-10-22")).toBe(30);
  });

  it("suggests 7 days when the period is already 30 days or shorter", () => {
    expect(shorterPeriodDays("2026-09-23", "2026-10-22")).toBe(7);
    expect(shorterPeriodDays("2026-10-15", "2026-10-22")).toBe(7);
  });

  it("suggests nothing for a week or less", () => {
    expect(shorterPeriodDays("2026-10-16", "2026-10-22")).toBeUndefined();
    expect(shorterPeriodDays("2026-10-22", "2026-10-22")).toBeUndefined();
  });

  it("treats a period without both dates as longer than every suggestion", () => {
    expect(shorterPeriodDays(undefined, "2026-10-22")).toBe(30);
    expect(shorterPeriodDays("2026-01-01", undefined)).toBe(30);
    expect(shorterPeriodDays("ikke-en-dato", "2026-10-22")).toBe(30);
  });
});
