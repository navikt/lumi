import type { FeedbackDto } from "~/types/api";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { inMemoryFilters } from "~/utils/analysisBudget";
import { applyFeedbackFilters } from "./utils/filters";

/** E2E fixture survey whose analyses can reach the mock's budget. */
export const MOCK_ANALYSIS_BUDGET_SURVEY_ID = "survey-analysegrense";

/**
 * Answers the mock lets an analysis of the fixture survey read. The API
 * allows 10 000. The fixture has an answer every other day for 90 days: 90
 * days are refused, 30 days are not, and one of its two tasks fits.
 */
export const MOCK_ANALYSIS_BUDGET = 25;

/** The API's typed error for a period with too many answers. */
export function analysisBudgetError(): ApiErrorException {
  return new ApiErrorException({
    status: 400,
    type: ErrorType.ANALYSIS_BUDGET_EXCEEDED,
    message:
      "Too much feedback data for in-memory analysis (max 10000 responses and 8 MiB total JSON size). Narrow the date range or add filters.",
    timestamp: new Date().toISOString(),
  });
}

/** The filters an endpoint applies in SQL, before the API counts answers. */
interface SqlFilters {
  surveyId?: string;
  app?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  task?: string;
}

/**
 * Throws the API's error when the fixture survey has more answers than the
 * budget after the endpoint's SQL filters. Leave out the filters the
 * endpoint applies in memory.
 */
export function assertMockAnalysisBudget(
  items: FeedbackDto[],
  { surveyId, app, fromDate, toDate, deviceType, task }: SqlFilters,
): void {
  if (surveyId !== MOCK_ANALYSIS_BUDGET_SURVEY_ID) return;

  const answers = applyFeedbackFilters(items, {
    surveyId,
    app,
    fromDate,
    toDate,
    deviceType,
    task: task?.trim() || undefined,
  });
  if (answers.length > MOCK_ANALYSIS_BUDGET) throw analysisBudgetError();
}

/** Mirrors the API: these filters run in memory, after the budget check. */
export function usesInMemoryFeedbackFilters(data: {
  task?: string;
  theme?: string;
  phrase?: string;
}): boolean {
  return inMemoryFilters(data).length > 0;
}
