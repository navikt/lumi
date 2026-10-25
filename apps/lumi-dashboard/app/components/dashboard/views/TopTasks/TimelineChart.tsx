import { Detail, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { BucketLink } from "~/components/shared/Charts/BucketLink";
import { ChartDataTable } from "~/components/shared/Charts/ChartDataTable";
import chartStyles from "~/components/shared/Charts/Charts.module.css";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import {
  activePoint,
  activePointIndex,
  bucketFeedbackSearch,
  DrilldownHint,
  formatCount,
  PARTIAL_DOT_LOOK,
  PartialDot,
  useTapGuard,
} from "~/components/shared/Charts/timeSeriesParts";
import { useTheme } from "~/context/ThemeContext";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSeriesWindow } from "~/hooks/useSeriesWindow";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import type { TopTasksResponse } from "~/types/api";
import {
  type AxisBucket,
  buildTimeAxis,
  describePartialBuckets,
  INTERVAL_NOUNS,
  sumByBucket,
  type TimeAxis,
  type TimeInterval,
} from "~/utils/timeBuckets";
import styles from "./TopTasks.module.css";

// Chart colors for dark mode (reused from others for consistency)
const CHART_COLORS = {
  success: "#2ced7b", // Bright green
  text: "rgba(255, 255, 255, 0.7)",
};

const CHART_COLORS_LIGHT = {
  success: "#16a34a", // Green 600 - darker for light mode
  text: "#262626", // Nav Gray 90
};

export interface SuccessRatePoint extends AxisBucket {
  /** Answers in the bucket. */
  total: number;
  /** Answers where the task was done. */
  success: number;
  /** The share of the answers where the task was done, or null without any. */
  rate: number | null;
}

export interface SuccessRateSeries {
  interval: TimeInterval;
  withYear: boolean;
  points: SuccessRatePoint[];
}

/**
 * The success rate per day, ISO week or month on the axis. Each bucket's
 * rate comes from its summed answers. An average of the days' rates would
 * give a day with one answer as much weight as a day with a hundred.
 */
export function successRateSeries(
  axis: TimeAxis,
  dailyStats: TopTasksResponse["dailyStats"],
): SuccessRateSeries {
  const days = Object.entries(dailyStats);
  const totals = sumByBucket(
    Object.fromEntries(days.map(([day, stat]) => [day, stat.total])),
    axis.interval,
  );
  const successes = sumByBucket(
    Object.fromEntries(days.map(([day, stat]) => [day, stat.success])),
    axis.interval,
  );

  return {
    interval: axis.interval,
    withYear: axis.withYear,
    points: axis.buckets.map((bucket) => {
      const total = totals.get(bucket.start) ?? 0;
      const success = successes.get(bucket.start) ?? 0;
      return {
        ...bucket,
        total,
        success,
        rate: total > 0 ? (success / total) * 100 : null,
      };
    }),
  };
}

/**
 * The success rate for the page's window. The section computes it once and
 * passes it to the chart, the note and the table.
 *
 * The Top Tasks numbers load apart from the statistics the window comes
 * from. Until both have loaded for new filters, the previous numbers keep
 * the window they were counted for.
 */
export function useSuccessRateSeries(): {
  series: SuccessRateSeries | undefined;
  isPending: boolean;
  /**
   * The series is the previous one while numbers for new filters load. Its
   * buckets then open nothing, since the address already has the new filters.
   */
  isStale: boolean;
} {
  const { data, isPending, isPlaceholderData } = useTopTasksStats();
  const dailyStats = data?.dailyStats;
  // The statistics filter on segment, and the Top Tasks numbers do not yet.
  // Without a start date, the axis must also reach the Top Tasks answers
  // from before the first day in the statistics.
  const answerDays = useMemo(() => Object.keys(dailyStats ?? {}), [dailyStats]);
  const {
    window,
    interval,
    isPending: isWindowPending,
    isPlaceholderData: isWindowPlaceholder,
  } = useSeriesWindow(answerDays);
  const current = useMemo(
    () =>
      window && dailyStats
        ? successRateSeries(buildTimeAxis(window, interval), dailyStats)
        : undefined,
    [window, interval, dailyStats],
  );
  const loaded = !isPlaceholderData && !isWindowPlaceholder;
  const [lastLoaded, setLastLoaded] = useState(loaded ? current : undefined);
  if (loaded && current !== lastLoaded) setLastLoaded(current);

  return {
    series: loaded ? current : lastLoaded,
    // Without numbers that belong together, the chart waits.
    isPending: isPending || isWindowPending || (!loaded && !lastLoaded),
    isStale: !loaded,
  };
}

function formatRate(rate: number): string {
  return `${Math.round(rate)}%`;
}

function hasAnswers(
  point: SuccessRatePoint,
): point is SuccessRatePoint & { rate: number } {
  return point.rate !== null;
}

/**
 * The search that opens a bucket's answers. The Top Tasks numbers do not
 * filter on segment yet, so the answers they open leave it out too.
 */
function successRateSearch<P extends object>(
  params: P,
  bucket: SuccessRatePoint,
) {
  return bucketFeedbackSearch({ ...params, segment: undefined }, bucket);
}

/** Names the partial weeks or months that have answers, under the chart. */
export function TopTasksTimelinePartialNote({
  series,
}: {
  series: SuccessRateSeries;
}) {
  const note = describePartialBuckets(
    series.points.filter((point) => point.partial && hasAnswers(point)),
    series.interval,
    PARTIAL_DOT_LOOK,
    series.withYear,
  );
  return note ? <Detail textColor="subtle">{note}</Detail> : null;
}

/** The success rate's numbers, under the chart. */
export function TopTasksTimelineTable({
  series,
  isStale = false,
}: {
  series: SuccessRateSeries;
  isStale?: boolean;
}) {
  const { params } = useSearchParams();
  const rows = series.points.filter(hasAnswers);
  if (rows.length === 0) return null;
  const nouns = INTERVAL_NOUNS[series.interval];

  return (
    <ChartDataTable
      label={`Suksessrate per ${nouns.one}`}
      rowHeader={nouns.rowHeader}
      columns={[
        { label: "Suksessrate" },
        { label: "Fullført" },
        { label: "Svar" },
      ]}
      rows={rows.map((point) => ({
        key: point.start,
        header: isStale ? (
          point.label
        ) : (
          <BucketLink search={successRateSearch(params, point)}>
            {point.label}
          </BucketLink>
        ),
        cells: [
          formatRate(point.rate),
          formatCount(point.success),
          formatCount(point.total),
        ],
      }))}
    />
  );
}

export function TopTasksTimelineChart({
  series,
  isPending,
  isStale = false,
}: {
  series: SuccessRateSeries | undefined;
  isPending: boolean;
  isStale?: boolean;
}) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const [hovered, setHovered] = useState<number>();
  const tapGuard = useTapGuard();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  const renderTooltip = useCallback(
    ({ active, payload }: TooltipContentProps) => {
      const point = active
        ? (payload?.[0]?.payload as SuccessRatePoint | undefined)
        : undefined;
      if (!point) return null;
      return (
        <div
          className={`${styles.tooltip} ${theme === "light" ? styles.tooltipLight : styles.tooltipDark}`}
        >
          <div className={styles.tooltipTitle}>{point.label}</div>
          {!hasAnswers(point) ? (
            <div className={styles.tooltipMeta}>Ingen svar</div>
          ) : (
            <>
              <div
                className={
                  theme === "light"
                    ? styles.tooltipSuccessLight
                    : styles.tooltipSuccessDark
                }
              >
                Suksessrate: {formatRate(point.rate)}
              </div>
              <div className={styles.tooltipMeta}>
                {formatCount(point.success)} av {formatCount(point.total)}{" "}
                oppgaver fullført
              </div>
              {isStale ? null : (
                <DrilldownHint className={chartStyles.tooltipHint} />
              )}
            </>
          )}
        </div>
      );
    },
    [theme, isStale],
  );

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (!series?.points.some(hasAnswers)) {
    return (
      <div
        className={`${styles.timelineEmpty} ${theme === "light" ? styles.timelineEmptyLight : styles.timelineEmptyDark}`}
      >
        Ingen data for valgt periode
      </div>
    );
  }

  const { points } = series;
  const nouns = INTERVAL_NOUNS[series.interval];
  // Points without answers open nothing and keep the arrow.
  const pointsAtAnswers =
    !isStale &&
    hovered !== undefined &&
    Boolean(points[hovered] && hasAnswers(points[hovered]));

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <AreaChart
        data={points}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        role="img"
        aria-label={`Linjediagram som viser suksessrate per ${nouns.one} for ${points.length} ${points.length === 1 ? nouns.one : nouns.many}`}
        onClick={(state, event) => {
          const point = activePoint(points, state);
          if (
            !point ||
            !hasAnswers(point) ||
            isStale ||
            tapGuard.isTap(event)
          ) {
            return;
          }
          navigate({
            to: "/feedback",
            search: successRateSearch(params, point),
          });
        }}
        onTouchStart={tapGuard.onTouchStart}
        onTouchEnd={tapGuard.onTouchEnd}
        onMouseMove={(state) => setHovered(activePointIndex(state))}
        onMouseLeave={() => setHovered(undefined)}
        // recharts sets cursor: default on its wrapper, so a class loses.
        style={{ cursor: pointsAtAnswers ? "pointer" : "default" }}
        // Keyboards use the table under the chart, where every bucket with
        // answers is a link.
        accessibilityLayer={false}
      >
        <defs>
          <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.success} stopOpacity={0.4} />
            <stop offset="95%" stopColor={colors.success} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="tick"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          orientation="left"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          domain={[0, 100]}
          unit="%"
          width="auto"
        />
        {/* The tooltip also names weeks without answers. By default recharts
            leaves out points without a value. */}
        <Tooltip content={renderTooltip} filterNull={false} />
        <Area
          type="linear"
          dataKey="rate"
          stroke={colors.success}
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSuccessRate)"
          connectNulls
          dot={PartialDot}
        />
      </AreaChart>
    </ResponsiveContainerWithInitialSize>
  );
}
