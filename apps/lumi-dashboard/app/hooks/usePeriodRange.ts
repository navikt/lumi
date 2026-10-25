import { useAnswerSpanState } from "~/hooks/useAnswerSpan";
import { useSearchParams } from "~/hooks/useSearchParams";
import { isSinceFirst } from "~/utils/dashboardPeriod";
import { isCalendarDate } from "~/utils/timeBuckets";

export interface PeriodRange {
  /** «Fra første svar» is chosen. */
  sinceFirst: boolean;
  /**
   * The first day. A period without a start, such as «Fra første svar»,
   * starts at the first answer for the selection in the filter bootstrap.
   * Undefined until the bootstrap has loaded, and when the selection has
   * no answers.
   */
  fromDate: string | undefined;
  toDate: string | undefined;
  /** The period has no start, and the filter bootstrap has not loaded. */
  isStartPending: boolean;
}

/**
 * The period chosen in the address, with the start filled in for a period
 * without one. The period button, the custom period, Eksporter and the
 * markers name it.
 */
export function usePeriodRange(): PeriodRange {
  const { params } = useSearchParams();
  const { span, isLoaded } = useAnswerSpanState();
  const openStart = !isCalendarDate(params.fromDate);

  return {
    sinceFirst: isSinceFirst(params),
    fromDate: openStart ? span?.fromDate : params.fromDate,
    toDate: params.toDate,
    isStartPending: openStart && !isLoaded,
  };
}
