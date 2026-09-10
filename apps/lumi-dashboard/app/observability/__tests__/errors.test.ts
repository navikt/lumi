import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiErrorException, ErrorType } from "~/types/errors";

const apm = vi.hoisted(() => ({
  captureException: vi.fn(),
  initialized: true,
}));

vi.mock("@nais/apm", () => ({
  captureException: apm.captureException,
  isInitialized: () => apm.initialized,
}));

import {
  reportDashboardRouteError,
  resetReportedDashboardErrorsForTesting,
} from "~/observability/errors";

const SENTINEL = "SURVEY_SENTINEL_NEVER_EXPORT";

function apiError(status: number, type: ErrorType) {
  return new ApiErrorException({
    status,
    type,
    message: SENTINEL,
    details: SENTINEL,
    path: `/feedback?answer=${SENTINEL}`,
    timestamp: "2026-08-30T10:00:00.000Z",
  });
}

describe("dashboard route error reporting", () => {
  beforeEach(() => {
    apm.captureException.mockReset();
    apm.initialized = true;
    resetReportedDashboardErrorsForTesting();
  });

  it("captures an unexpected error once with a safe replacement message", () => {
    const error = new Error(SENTINEL);

    reportDashboardRouteError(error);
    reportDashboardRouteError(error);

    expect(apm.captureException).toHaveBeenCalledTimes(1);
    const [captured, options] = apm.captureException.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("Unexpected Lumi dashboard error");
    expect(captured.stack).not.toContain(SENTINEL);
    expect(options).toEqual({ fingerprint: "lumi-dashboard-route-error" });
  });

  it("captures server errors but ignores expected client and access errors", () => {
    reportDashboardRouteError(apiError(403, ErrorType.AUTHORIZATION_ERROR));
    reportDashboardRouteError(apiError(404, ErrorType.NOT_FOUND));
    reportDashboardRouteError(apiError(503, ErrorType.INTERNAL_SERVER_ERROR));

    expect(apm.captureException).toHaveBeenCalledTimes(1);
    const [captured] = apm.captureException.mock.calls[0];
    expect(captured.message).toBe(
      "Lumi dashboard API error (503 INTERNAL_SERVER_ERROR)",
    );
    expect(captured.stack).not.toContain(SENTINEL);
  });

  it("does nothing before browser APM is initialized", () => {
    apm.initialized = false;

    reportDashboardRouteError(new Error(SENTINEL));

    expect(apm.captureException).not.toHaveBeenCalled();
  });
});
