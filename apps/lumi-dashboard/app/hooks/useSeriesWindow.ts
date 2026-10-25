import { useMemo } from "react";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useShownFirstAnswer } from "~/hooks/useShownFirstAnswer";
import { useStats } from "~/hooks/useStats";
import {
  earliestDate,
  isCalendarDate,
  laterDate,
  latestDate,
  resolveSeriesWindow,
  type SeriesWindow,
  type TimeInterval,
} from "~/utils/timeBuckets";

export interface SeriesWindowState {
  /**
   * The days the time series show. Missing until the statistics have
   * loaded, and when the period has neither a start nor answers.
   */
  window: SeriesWindow | undefined;
  /** The resolution for the window, unless the viewer chooses one. */
  interval: TimeInterval;
  /**
   * The last day the series may show: today in Oslo, or the last day with
   * answers when the browser's clock is behind.
   */
  today: string;
  /** The statistics are loading for the first time. */
  isPending: boolean;
  /** The statistics belong to the previous filters while new ones load. */
  isPlaceholderData: boolean;
}

const NO_DAYS: readonly string[] = [];

/**
 * The window and resolution the time series on the page use, and their
 * headings with them.
 *
 * The window follows the period of the statistics on screen. While new
 * statistics load, the previous numbers keep their own buckets. Answers
 * dated after the browser's today still count, in case its clock is behind.
 *
 * A period without a start, such as «Fra første svar», begins on the day of
 * the first answer for the selection in the filter bootstrap. With filters
 * the bootstrap does not apply, the first days can be empty. Previous
 * numbers keep the first answer they were shown with.
 *
 * `extraDays` are days with answers in numbers the statistics do not count,
 * such as Top Tasks, which does not filter on segment yet. They count like
 * the days in the statistics, so a period without a start begins with the
 * earliest of them.
 */
export function useSeriesWindow(
  extraDays: readonly string[] = NO_DAYS,
): SeriesWindowState {
  const { params } = useSearchParams();
  const { data: stats, isPending, isPlaceholderData } = useStats();
  const osloToday = useOsloToday();
  const byDate = stats?.byDate;
  // The statistics echo the period they were asked for. The address is the
  // fallback for statistics without it.
  const period = stats
    ? (stats.period ?? { fromDate: params.fromDate, toDate: params.toDate })
    : undefined;
  const fromDate = period?.fromDate ?? null;
  const toDate = period?.toDate ?? null;
  const retentionStartDate = stats?.retentionStartDate ?? null;
  const shownFirstAnswer = useShownFirstAnswer();
  const firstAnswer = isCalendarDate(fromDate) ? undefined : shownFirstAnswer;

  const days = useMemo(
    () =>
      [
        ...Object.keys(byDate ?? {}),
        ...extraDays,
        ...(firstAnswer ? [firstAnswer] : []),
      ].filter(isCalendarDate),
    [byDate, extraDays, firstAnswer],
  );
  const today = laterDate(osloToday, latestDate(days));
  const firstDataDay = earliestDate(days);
  const resolved = useMemo(
    () =>
      byDate
        ? resolveSeriesWindow({
            // With the first answer known, the axis starts on that day, as
            // the period button and the card say. It stays among the days,
            // so the retention floor does not move it.
            fromDate: firstAnswer ? (firstDataDay ?? null) : fromDate,
            toDate,
            today,
            firstDataDay,
            retentionStartDate,
          })
        : undefined,
    [
      byDate,
      firstAnswer,
      firstDataDay,
      fromDate,
      toDate,
      today,
      retentionStartDate,
    ],
  );

  return {
    window: resolved?.window,
    interval: resolved?.interval ?? "week",
    today,
    isPending,
    isPlaceholderData,
  };
}
