import { captureException, isInitialized } from "@nais/apm";

import { ApiErrorException } from "~/types/errors";

let reportedErrors = new WeakSet<object>();

function isReportableApiError(error: ApiErrorException): boolean {
  return error.error.status >= 500;
}

export function createSafeTelemetryError(error: Error): Error {
  const message =
    error instanceof ApiErrorException
      ? `Lumi dashboard API error (${error.error.status} ${error.error.type})`
      : "Unexpected Lumi dashboard error";
  const safe = new Error(message);
  safe.name = "LumiDashboardError";

  const originalFrames = error.stack?.split("\n").slice(1) ?? [];
  if (originalFrames.length > 0) {
    safe.stack = `${safe.name}: ${safe.message}\n${originalFrames.join("\n")}`;
  }
  return safe;
}

export function reportDashboardRouteError(error: Error): void {
  if (!isInitialized()) return;
  if (error instanceof ApiErrorException && !isReportableApiError(error))
    return;
  if (reportedErrors.has(error)) return;

  reportedErrors.add(error);
  captureException(createSafeTelemetryError(error), {
    fingerprint: "lumi-dashboard-route-error",
  });
}

export function resetReportedDashboardErrorsForTesting(): void {
  reportedErrors = new WeakSet<object>();
}
