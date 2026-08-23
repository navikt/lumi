import { describe, expect, it } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import {
  ANALYSIS_BUDGET_ERROR_DESCRIPTION,
  getDashboardStatsErrorDescription,
} from "../dashboardStatsError";

function apiError(type: ErrorType, status = 400) {
  return new ApiErrorException({
    status,
    type,
    message: "test error",
    timestamp: "2026-08-23T00:00:00Z",
  });
}

describe("getDashboardStatsErrorDescription", () => {
  it("returns narrowing guidance for the typed analysis budget error", () => {
    expect(
      getDashboardStatsErrorDescription(
        apiError(ErrorType.ANALYSIS_BUDGET_EXCEEDED),
      ),
    ).toBe(ANALYSIS_BUDGET_ERROR_DESCRIPTION);
  });

  it("keeps generic recovery copy for unrelated API and runtime errors", () => {
    expect(
      getDashboardStatsErrorDescription(apiError(ErrorType.BAD_REQUEST)),
    ).toBeUndefined();
    expect(
      getDashboardStatsErrorDescription(new Error("network failure")),
    ).toBeUndefined();
  });
});
