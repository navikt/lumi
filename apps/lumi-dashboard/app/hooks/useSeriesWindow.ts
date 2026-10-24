import { useMemo } from "react";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
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

/**
 * The window and resolution all time series on the page use, and their
 * headings with them.
 *
 * The window follows the period of the statistics on screen. While new
 * statistics load, the previous numbers keep their own buckets. Answers
 * dated after the browser's today still count, in case its clock is behind.
 */
export function useSeriesWindow(): SeriesWindowState {
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

  const days = useMemo(
    () => Object.keys(byDate ?? {}).filter(isCalendarDate),
    [byDate],
  );
  const today = laterDate(osloToday, latestDate(days));
  const resolved = useMemo(
    () =>
      byDate
        ? resolveSeriesWindow({
            fromDate,
            toDate,
            today,
            firstDataDay: earliestDate(days),
            retentionStartDate,
          })
        : undefined,
    [byDate, days, fromDate, toDate, today, retentionStartDate],
  );

  return {
    window: resolved?.window,
    interval: resolved?.interval ?? "week",
    today,
    isPending,
    isPlaceholderData,
  };
}
