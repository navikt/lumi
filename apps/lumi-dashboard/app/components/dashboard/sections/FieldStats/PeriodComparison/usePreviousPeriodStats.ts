import { useQuery } from "@tanstack/react-query";
import { useOsloToday } from "~/hooks/useOsloToday";
import { useSearchParams } from "~/hooks/useSearchParams";
import { statsQueryOptions } from "~/hooks/useStats";
import type { FeedbackStats } from "~/types/api";
import { getComparisonPeriods } from "./comparisonPeriods";
import { usableComparisonStats } from "./model";

export { getComparisonPeriods } from "./comparisonPeriods";

export function usePreviousPeriodStats(
  enabled: boolean,
  currentStats?: FeedbackStats,
) {
  const { params } = useSearchParams();
  const today = useOsloToday();
  const periods = getComparisonPeriods(
    params.fromDate,
    params.toDate,
    params.compare,
    today,
    params.periodPreset,
  );
  const comparisonEnabled =
    enabled &&
    Boolean(
      params.surveyId &&
        periods &&
        !periods.hasFutureDates &&
        periods.mode !== "none",
    );

  const query = useQuery({
    ...statsQueryOptions({
      ...params,
      fromDate: periods?.previous.fromDate,
      toDate: periods?.previous.toDate,
    }),
    enabled: comparisonEnabled,
  });

  const previousStats = usableComparisonStats(query.data, query.isError);
  const retentionStart =
    currentStats?.retentionStartDate && previousStats?.retentionStartDate
      ? [currentStats.retentionStartDate, previousStats.retentionStartDate]
          .sort()
          .at(-1)
      : undefined;
  const unavailableReason = !comparisonEnabled
    ? undefined
    : query.isError
      ? "Perioden før kunne ikke hentes"
      : query.data?.privacy?.masked
        ? "Perioden før er skjult av personvernhensyn"
        : query.isPending || !currentStats
          ? undefined
          : !retentionStart
            ? "Historikken for sammenligningen kunne ikke bekreftes"
            : periods &&
                (periods.current.fromDate < retentionStart ||
                  periods.previous.fromDate < retentionStart)
              ? "Hele sammenligningsperioden er ikke lenger tilgjengelig"
              : previousStats?.totalCount === 0
                ? "Ingen svar å sammenligne med i forrige periode"
                : undefined;

  return {
    ...query,
    comparisonData:
      comparisonEnabled && !unavailableReason ? previousStats : undefined,
    comparisonAvailable: comparisonEnabled && !unavailableReason,
    unavailableReason,
    comparisonEnabled,
    periods,
  };
}
