import { Detail, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  type BarShapeProps,
  CartesianGrid,
  Rectangle,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { ChartDataTable } from "~/components/shared/Charts/ChartDataTable";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSeriesWindow } from "~/hooks/useSeriesWindow";
import { useStats } from "~/hooks/useStats";
import {
  type AxisBucket,
  buildTimeAxis,
  describePartialBuckets,
  INTERVAL_NOUNS,
  sumByBucket,
  type TimeAxis,
  type TimeInterval,
} from "~/utils/timeBuckets";
import styles from "./Charts.module.css";
import {
  activePoint,
  activePointIndex,
  bucketFeedbackSearch,
  formatCount,
} from "./timeSeriesParts";

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

/**
 * A bar for a week or month that is only partly in the period is lighter
 * and has a dashed edge in the full colour. The edge keeps the bar visible
 * against the background (WCAG 1.4.11), and the dashes tell it apart from
 * a whole bar without colour alone.
 */
const PARTIAL_BAR_OPACITY = 0.45;

const PARTIAL_BAR_LOOK = {
  one: "lysere søyle med stiplet kant",
  many: "lysere søyler med stiplet kant",
};

/** What the timeline counts, in the words of the section's heading. */
export type TimelineNoun = "tilbakemeldinger" | "svar";

const NOUN_FORMS: Record<
  TimelineNoun,
  { one: string; many: string; column: string }
> = {
  tilbakemeldinger: {
    one: "tilbakemelding",
    many: "tilbakemeldinger",
    column: "Tilbakemeldinger",
  },
  svar: { one: "svar", many: "svar", column: "Svar" },
};

export interface CountPoint extends AxisBucket {
  count: number;
}

export interface CountSeries {
  interval: TimeInterval;
  withYear: boolean;
  points: CountPoint[];
  total: number;
}

/**
 * Answers per day, ISO week or month on the axis. Empty buckets are
 * included with 0, which keeps the time axis even.
 */
export function countSeries(
  axis: TimeAxis,
  byDate: Record<string, number>,
): CountSeries {
  const sums = sumByBucket(byDate, axis.interval);
  const points = axis.buckets.map((bucket) => ({
    ...bucket,
    count: sums.get(bucket.start) ?? 0,
  }));
  return {
    interval: axis.interval,
    withYear: axis.withYear,
    points,
    total: points.reduce((sum, point) => sum + point.count, 0),
  };
}

/**
 * The timeline for the page's window. The section computes it once and
 * passes it to the chart, the note and the table.
 */
export function useCountSeries(): {
  series: CountSeries | undefined;
  isPending: boolean;
} {
  const { data: stats } = useStats();
  const { window, interval, isPending } = useSeriesWindow();
  const byDate = stats?.byDate;
  const series = useMemo(
    () =>
      window && byDate
        ? countSeries(buildTimeAxis(window, interval), byDate)
        : undefined,
    [window, interval, byDate],
  );
  return { series, isPending };
}

interface TimelineProps {
  series: CountSeries;
  noun?: TimelineNoun;
}

/** The timeline's numbers, under the chart. */
export function TimelineChartTable({
  series,
  noun = "tilbakemeldinger",
}: TimelineProps) {
  if (series.total === 0) return null;
  const nouns = INTERVAL_NOUNS[series.interval];

  return (
    <ChartDataTable
      label={`Antall ${noun} per ${nouns.one}`}
      rowHeader={nouns.rowHeader}
      columns={[{ label: NOUN_FORMS[noun].column }]}
      rows={series.points.map((point) => ({
        key: point.start,
        header: point.label,
        cells: [formatCount(point.count)],
      }))}
    />
  );
}

/** Names the partial weeks or months that have a bar, under the chart. */
export function TimelinePartialNote({ series }: { series: CountSeries }) {
  const note = describePartialBuckets(
    series.points.filter((point) => point.partial && point.count > 0),
    series.interval,
    PARTIAL_BAR_LOOK,
    series.withYear,
  );
  return note ? <Detail textColor="subtle">{note}</Detail> : null;
}

function renderTimelineBar(props: BarShapeProps) {
  return (props.payload as CountPoint | undefined)?.partial ? (
    <Rectangle
      {...props}
      fillOpacity={PARTIAL_BAR_OPACITY}
      stroke={props.fill}
      strokeWidth={1.5}
      strokeDasharray="4 2"
    />
  ) : (
    <Rectangle {...props} />
  );
}

export function TimelineChart({
  series,
  isPending = false,
  noun = "tilbakemeldinger",
}: {
  series: CountSeries | undefined;
  isPending?: boolean;
  noun?: TimelineNoun;
}) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { isMobile } = useBreakpoint();
  const [hovered, setHovered] = useState<number>();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;
  const forms = NOUN_FORMS[noun];

  const renderTooltip = useCallback(
    ({ active, payload }: TooltipContentProps) => {
      const point = active ? (payload?.[0]?.payload as CountPoint) : undefined;
      if (!point) return null;
      return (
        <div className={styles.tooltipCard}>
          <div className={styles.tooltipTitle}>{point.label}</div>
          <div>
            {formatCount(point.count)}{" "}
            {point.count === 1 ? forms.one : forms.many}
          </div>
          {point.count > 0 ? (
            <div className={styles.tooltipHint}>
              Klikk for å åpne tilbakemeldinger
            </div>
          ) : null}
        </div>
      );
    },
    [forms],
  );

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (!series || series.total === 0) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  const { points } = series;
  const nouns = INTERVAL_NOUNS[series.interval];
  // Bars without answers open nothing and keep the arrow.
  const pointsAtAnswers =
    hovered !== undefined && (points[hovered]?.count ?? 0) > 0;

  // Responsive chart margins - minimal margins to maximize chart area
  const chartMargin = isMobile
    ? { top: 15, right: 5, left: 0, bottom: 20 }
    : { top: 15, right: 10, left: 5, bottom: 20 };

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
        aria-label={`Søylediagram som viser antall ${noun} per ${nouns.one} for ${points.length} ${points.length === 1 ? nouns.one : nouns.many}`}
        onClick={(state) => {
          const point = activePoint(points, state);
          // An empty bar would open an empty list.
          if (!point || point.count === 0) return;
          navigate({
            to: "/feedback",
            search: bucketFeedbackSearch(params, point),
          });
        }}
        onMouseMove={(state) => setHovered(activePointIndex(state))}
        onMouseLeave={() => setHovered(undefined)}
        // recharts sets cursor: default on its wrapper, so a class loses.
        style={{ cursor: pointsAtAnswers ? "pointer" : "default" }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="tick"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width="auto"
          tickFormatter={formatCount}
          allowDecimals={false}
          hide={isMobile}
        />
        <Tooltip
          cursor={{ fill: colors.primaryFaded }}
          content={renderTooltip}
        />
        <Bar
          dataKey="count"
          fill={colors.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
          shape={renderTimelineBar}
        />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
