import { Detail, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  type TooltipIndex,
  XAxis,
  YAxis,
} from "recharts";
import { ChartDataTable } from "~/components/shared/Charts/ChartDataTable";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import {
  bucketStart,
  calendarBucket,
  chooseInterval,
  formatBucketLabel,
  formatBucketTick,
  INTERVAL_NOUNS,
  periodBuckets,
  spansSeveralYears,
  type TimeInterval,
} from "~/utils/timeBuckets";
import styles from "./Charts.module.css";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#5EEAD4", // Teal for good visibility in dark mode
  primaryFaded: "rgba(94, 234, 212, 0.2)",
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
};

const CHART_COLORS_LIGHT = {
  primary: "#0067c5", // Nav Blue for light mode
  primaryFaded: "rgba(0, 103, 197, 0.1)",
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
};

/** Opacity of a bar for a week or month that is only partly in the period. */
const PARTIAL_BAR_OPACITY = 0.45;

export interface TimelinePoint {
  key: string;
  tick: string;
  label: string;
  count: number;
  partial: boolean;
  /** First and last day of the bucket inside the period. */
  from: string;
  to: string;
}

/**
 * Answers per day, ISO week or month for the period. Every bucket up to
 * today is included, also the empty ones, so the time axis is even. Without
 * a period the days the API returned are shown as they are.
 */
export function timelineChartData(
  byDate: Record<string, number>,
  fromDate?: string,
  toDate?: string,
  today?: string,
): { interval: TimeInterval; points: TimelinePoint[] } {
  const interval = chooseInterval(fromDate, toDate, today);
  const buckets = periodBuckets(fromDate, toDate, interval, today);

  if (buckets.length === 0) {
    const points = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => {
        const bucket = calendarBucket(date, "day");
        return {
          key: date,
          tick: formatBucketTick(bucket, "day", false),
          label: formatBucketLabel(bucket, "day"),
          count,
          partial: false,
          from: date,
          to: date,
        };
      });
    return { interval: "day", points };
  }

  const counts = new Map<string, number>();
  for (const [date, count] of Object.entries(byDate)) {
    const key = bucketStart(date, interval);
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  const withYear = spansSeveralYears(buckets);

  return {
    interval,
    points: buckets.map((bucket) => ({
      key: bucket.start,
      tick: formatBucketTick(bucket, interval, withYear),
      label: formatBucketLabel(bucket, interval),
      count: counts.get(bucket.start) ?? 0,
      partial: bucket.partial,
      from: bucket.from,
      to: bucket.to,
    })),
  };
}

function useTimelineData() {
  const { data: stats, isPending } = useStats();
  const { params } = useSearchParams();
  const series = timelineChartData(
    stats?.byDate ?? {},
    params.fromDate,
    params.toDate,
  );
  const total = series.points.reduce((sum, point) => sum + point.count, 0);
  return { ...series, total, isPending };
}

/** The resolution of the timeline for the selected period. */
export function useTimelineInterval(): TimeInterval {
  const { params } = useSearchParams();
  return chooseInterval(params.fromDate, params.toDate);
}

/** The timeline's numbers, under the chart. */
export function TimelineChartTable() {
  const { interval, points, total, isPending } = useTimelineData();
  if (isPending || total === 0) return null;

  return (
    <ChartDataTable
      label={`Antall tilbakemeldinger per ${INTERVAL_NOUNS[interval].one}`}
      rowHeader={INTERVAL_NOUNS[interval].rowHeader}
      columns={[{ label: "Tilbakemeldinger" }]}
      rows={points.map((point) => ({
        key: point.key,
        header: point.label,
        cells: [point.count.toLocaleString("no-NO")],
      }))}
    />
  );
}

/** Explains the lighter bars, when the period has partial weeks or months. */
export function TimelinePartialNote() {
  const { interval, points, total, isPending } = useTimelineData();
  if (isPending || total === 0 || !points.some((point) => point.partial)) {
    return null;
  }

  return (
    <Detail textColor="subtle">
      {interval === "month" ? "Måneder" : "Uker"} som bare delvis er med i
      perioden, har lysere søyle.
    </Detail>
  );
}

export function TimelineChart() {
  const { interval, points, total, isPending } = useTimelineData();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { isMobile } = useBreakpoint();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;
  const nouns = INTERVAL_NOUNS[interval];

  // Responsive chart margins - minimal margins to maximize chart area
  const chartMargin = isMobile
    ? { top: 15, right: 5, left: 0, bottom: 20 }
    : { top: 15, right: 10, left: 5, bottom: 20 };

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (total === 0) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  const tickByKey = new Map(points.map((point) => [point.key, point.tick]));

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <BarChart
        data={points}
        margin={chartMargin}
        role="img"
        aria-label={`Stolpediagram som viser antall tilbakemeldinger per ${nouns.one} for ${points.length} ${points.length === 1 ? nouns.one : nouns.many}`}
        onClick={(state: {
          activeTooltipIndex?: number | TooltipIndex;
          activeIndex?: number | TooltipIndex;
          activeLabel?: string | number;
        }) => {
          const rawIndex = state.activeTooltipIndex ?? state.activeIndex;
          const index =
            typeof rawIndex === "number"
              ? rawIndex
              : typeof rawIndex === "string"
                ? Number.parseInt(rawIndex, 10)
                : undefined;

          const clickData =
            typeof index === "number" && Number.isFinite(index)
              ? points[index]
              : typeof state.activeLabel === "string"
                ? points.find((point) => point.key === state.activeLabel)
                : undefined;
          if (!clickData) return;

          // The bucket's days inside the period, as a fixed period.
          navigate({
            to: "/feedback",
            search: {
              ...params,
              dateMode: "fixed",
              fromDate: clickData.from,
              toDate: clickData.to,
              periodPreset: undefined,
              page: "1",
            },
          });
        }}
        className={styles.chartClickable}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="key"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          tickFormatter={(key: string) => tickByKey.get(key) ?? key}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width={25}
          allowDecimals={false}
          hide={isMobile}
        />
        <Tooltip
          cursor={{ fill: colors.primaryFaded }}
          content={({ active, payload }) => {
            if (active && payload?.length && payload[0]) {
              const point = payload[0].payload as TimelinePoint;
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipTitle}>{point.label}</div>
                  <div>
                    {point.count.toLocaleString("no-NO")} tilbakemeldinger
                  </div>
                  <div className={styles.tooltipHint}>
                    Klikk for å åpne tilbakemeldinger
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar
          dataKey="count"
          fill={colors.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
          cursor="pointer"
        >
          {points.map((point) => (
            <Cell
              key={point.key}
              fillOpacity={point.partial ? PARTIAL_BAR_OPACITY : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
