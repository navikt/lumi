import dayjs from "dayjs";
import { ApiErrorException, ErrorType } from "~/types/errors";

/**
 * Some analyses read every answer in the period into the API's memory. The
 * API refuses a period with more than 10 000 answers or 8 MiB of answer data,
 * and gives the same answer to the same request. A shorter period always
 * helps. Filters the database applies, such as device, also help.
 */
export function isAnalysisBudgetError(error: unknown): boolean {
  return (
    error instanceof ApiErrorException &&
    error.error.type === ErrorType.ANALYSIS_BUDGET_EXCEEDED
  );
}

export const ANALYSIS_BUDGET_TITLE = "Perioden har for mange svar";

/** For a part of the page that is computed from every answer. */
export function analysisBudgetDescription(subject: string): string {
  return `${subject} kan ikke regnes ut for så mange svar. Velg en kortere periode.`;
}

/**
 * The API applies the task, theme and phrase filters after it has read the
 * answers. Removing such a filter makes the request smaller.
 */
export const FILTER_BUDGET_DESCRIPTION =
  "Lumi kan ikke filtrere på oppgave, tema eller uttrykk i så mange svar. Velg en kortere periode, eller fjern filteret.";

const SHORTER_PERIOD_DAYS = [30, 7] as const;

function isValidDate(value: string | undefined): value is string {
  return Boolean(value && dayjs(value).isValid());
}

/**
 * The last day the period has answers for: its end date, or today when the
 * end is later or missing.
 */
export function periodEnd(toDate?: string, today = dayjs()): dayjs.Dayjs {
  const end = isValidDate(toDate) ? dayjs(toDate) : today;
  return end.isAfter(today, "day") ? today.startOf("day") : end;
}

/**
 * Days in the period up to its end. A period without a start has no limit.
 */
export function periodDays(
  fromDate?: string,
  toDate?: string,
  today = dayjs(),
): number {
  if (!isValidDate(fromDate)) return Number.POSITIVE_INFINITY;
  return periodEnd(toDate, today).diff(dayjs(fromDate), "day") + 1;
}

/**
 * The longest suggested period that is shorter than the selected one, or
 * nothing when the period is a week or shorter.
 */
export function shorterPeriodDays(
  fromDate?: string,
  toDate?: string,
  today = dayjs(),
): number | undefined {
  const days = periodDays(fromDate, toDate, today);
  return SHORTER_PERIOD_DAYS.find((candidate) => candidate < days);
}
