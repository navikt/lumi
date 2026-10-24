import { ApiErrorException, ErrorType } from "~/types/errors";
import type { DateRange } from "~/utils/dashboardPeriod";

/**
 * Some analyses read every answer in the period into the API's memory. The
 * API turns down a period with more than 10 000 answers or 8 MiB of answer
 * data, and gives the same answer each time. A part of the period never has
 * more answers than the whole period. Filters the database applies, such as
 * device, can also help.
 */
export function isAnalysisBudgetError(error: unknown): boolean {
  return (
    error instanceof ApiErrorException &&
    error.error.type === ErrorType.ANALYSIS_BUDGET_EXCEEDED
  );
}

export const ANALYSIS_BUDGET_TITLE = "Perioden har for mange svar";

/**
 * For a part of the page that is computed from every answer. The alert adds
 * what the user can do.
 */
export function describeAnalysisBudget(subject: string): string {
  return `${subject} kan ikke regnes ut for så mange svar.`;
}

/**
 * The API applies the task, theme and phrase filters after it has read the
 * answers. Without them, it filters and pages in SQL.
 */
export const FILTER_BUDGET_DESCRIPTION =
  "Lumi kan ikke filtrere så mange svar på oppgave, tema eller uttrykk.";

const IN_MEMORY_FILTERS = ["task", "theme", "phrase"] as const;
export type InMemoryFilter = (typeof IN_MEMORY_FILTERS)[number];

/** What the alert calls the filters. */
const IN_MEMORY_FILTER_NAMES: Record<InMemoryFilter, string> = {
  task: "oppgave",
  theme: "tema",
  phrase: "uttrykk",
};

/**
 * The filters among task, theme and phrase that are set. The API ignores a
 * value with only spaces.
 */
export function inMemoryFilters(params: {
  task?: string;
  theme?: string;
  phrase?: string;
}): InMemoryFilter[] {
  return IN_MEMORY_FILTERS.filter((key) => params[key]?.trim());
}

/** The filters to remove, such as «filteret på oppgave». */
export function nameFilters(filters: InMemoryFilter[]): string {
  const names = filters.map((filter) => IN_MEMORY_FILTER_NAMES[filter]);
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(", ")} og ${names.at(-1)}`
      : (names[0] ?? "");
  return `${names.length > 1 ? "filtrene" : "filteret"} på ${list}`;
}

const SHORTER_PERIOD_DAYS = [30, 7] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A `YYYY-MM-DD` day as midnight UTC. Counting days in UTC keeps a shift to
 * or from daylight saving time out of the count.
 */
function utcDay(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
    ? undefined
    : time;
}

function isoDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * The last 30 or 7 days of the part of the period that can have answers:
 * from the later of its start and the first answer, to the earliest of its
 * end, today and the last answer. That part never has more answers than the
 * period. Nothing is suggested when it is a week or shorter. Without the
 * answer span, the period itself is used.
 */
export function shorterPeriod(
  period: { fromDate?: string; toDate?: string },
  today: string,
  answerSpan?: DateRange,
): DateRange | undefined {
  const todayTime = utcDay(today);
  if (todayTime === undefined) return undefined;
  let start = utcDay(period.fromDate);
  let end = Math.min(utcDay(period.toDate) ?? todayTime, todayTime);

  const first = utcDay(answerSpan?.fromDate);
  const last = utcDay(answerSpan?.toDate);
  if (first !== undefined && last !== undefined) {
    const clippedStart = Math.max(start ?? first, first);
    const clippedEnd = Math.min(end, last);
    // The API found answers in the period. A span outside it is out of date,
    // since the bootstrap is cached for up to five minutes.
    if (clippedStart <= clippedEnd) {
      start = clippedStart;
      end = clippedEnd;
    }
  }

  const days =
    start === undefined
      ? Number.POSITIVE_INFINITY
      : Math.round((end - start) / DAY_MS) + 1;
  const length = SHORTER_PERIOD_DAYS.find((candidate) => candidate < days);
  if (!length) return undefined;

  return {
    fromDate: isoDay(end - (length - 1) * DAY_MS),
    toDate: isoDay(end),
  };
}
