import dayjs from "dayjs";
import { ApiErrorException, ErrorType } from "~/types/errors";

/**
 * Some analyses read every answer into the API's memory. The API refuses a
 * period with more than 10 000 answers or 8 MiB of answer data. Retrying the
 * same request gives the same answer, so only a shorter period helps.
 */
export function isAnalysisBudgetError(error: unknown): boolean {
  return (
    error instanceof ApiErrorException &&
    error.error.status === 400 &&
    error.error.type === ErrorType.ANALYSIS_BUDGET_EXCEEDED
  );
}

export const ANALYSIS_BUDGET_DESCRIPTION =
  "Det er for mange svar i perioden til at analysen kan regnes ut. Velg en kortere periode.";

/**
 * The task, theme and phrase filters run after the answers are read, so
 * they do not make the request smaller.
 */
export const FILTER_BUDGET_DESCRIPTION =
  "Det er for mange svar i perioden til å filtrere på oppgave, tema eller frase. Velg en kortere periode.";

const SHORTER_PERIOD_DAYS = [30, 7] as const;

/**
 * The longest suggested period that is shorter than the selected one. A
 * period without both dates counts as longer than every suggestion.
 */
export function shorterPeriodDays(
  fromDate?: string,
  toDate?: string,
): number | undefined {
  const from = fromDate ? dayjs(fromDate) : undefined;
  const to = toDate ? dayjs(toDate) : undefined;
  const days =
    from?.isValid() && to?.isValid()
      ? to.diff(from, "day") + 1
      : Number.POSITIVE_INFINITY;

  return SHORTER_PERIOD_DAYS.find((candidate) => candidate < days);
}
