import dayjs from "dayjs";
import { ApiErrorException, ErrorType } from "~/types/errors";

/**
 * E2E fixture survey whose analyses hit the API's analysis budget when the
 * period is longer than 30 days. The real API counts answers and bytes; the
 * mock only needs a trigger the tests can predict.
 */
export const MOCK_ANALYSIS_BUDGET_SURVEY_ID = "survey-analysegrense";
const MOCK_ANALYSIS_BUDGET_MAX_DAYS = 30;

interface AnalysisBudgetRequest {
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
}

/** Throws the API's typed error for the fixture survey's long periods. */
export function assertMockAnalysisBudget({
  surveyId,
  fromDate,
  toDate,
}: AnalysisBudgetRequest): void {
  if (surveyId !== MOCK_ANALYSIS_BUDGET_SURVEY_ID) return;

  const from = fromDate ? dayjs(fromDate) : undefined;
  const to = toDate ? dayjs(toDate) : undefined;
  if (
    from?.isValid() &&
    to?.isValid() &&
    to.diff(from, "day") + 1 <= MOCK_ANALYSIS_BUDGET_MAX_DAYS
  ) {
    return;
  }

  throw new ApiErrorException({
    status: 400,
    type: ErrorType.ANALYSIS_BUDGET_EXCEEDED,
    message:
      "Too much feedback data for in-memory analysis (max 10000 responses and 8 MiB total JSON size). Narrow the date range or add filters.",
    timestamp: new Date().toISOString(),
  });
}

/** Mirrors the API: these filters run in memory, after the budget check. */
export function usesInMemoryFeedbackFilters(data: {
  task?: string;
  theme?: string;
  phrase?: string;
}): boolean {
  return Boolean(data.task || data.theme || data.phrase);
}
