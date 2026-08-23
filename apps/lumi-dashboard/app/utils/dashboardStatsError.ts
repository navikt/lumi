import { ApiErrorException, ErrorType } from "~/types/errors";

export const ANALYSIS_BUDGET_ERROR_DESCRIPTION =
  "Snevre inn perioden eller legg til filtre før du prøver igjen.";

export function getDashboardStatsErrorDescription(
  error: unknown,
): string | undefined {
  if (
    error instanceof ApiErrorException &&
    error.error.status === 400 &&
    error.error.type === ErrorType.ANALYSIS_BUDGET_EXCEEDED
  ) {
    return ANALYSIS_BUDGET_ERROR_DESCRIPTION;
  }

  return undefined;
}
