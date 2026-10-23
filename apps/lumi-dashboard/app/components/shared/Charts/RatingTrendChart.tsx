import { Alert, Detail, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useRef } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  type TooltipIndex,
  XAxis,
  YAxis,
} from "recharts";
import {
  getRatingMetric,
  ratingResponseCount,
  ratingTrendTitle,
} from "~/components/dashboard/sections/FieldStats/PeriodComparison/model";
import {
  questionTrendRatingMetric,
  questionTrendRatingValue,
} from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import { ChartDataTable } from "~/components/shared/Charts/ChartDataTable";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { RatingMarker } from "~/types/api";
import { todayInOslo } from "~/utils/dashboardPeriod";
import {
  bucketStart,
  calendarBucket,
  chooseInterval,
  describePartialBuckets,
  formatBucketLabel,
  formatBucketTick,
  INTERVAL_NOUNS,
  laterDate,
  periodBuckets,
  spansSeveralYears,
  type TimeBucket,
  type TimeInterval,
} from "~/utils/timeBuckets";
import styles from "./Charts.module.css";

interface RatingTrendChartProps {
  markers?: RatingMarker[];
}

interface MarkerLabelMeta {
  offsetY: number;
  text: string;
}

interface TrendPoint {
  /** First day of the bucket, the point's place on the time axis. */
  date: string;
  /** First and last day of the bucket inside the period. */
  from: string;
  to: string;
  tick: string;
  label: string;
  /** Part of the week or month is outside the period. */
  partial: boolean;
  average: number | null;
  count: number;
  /** Too few answers to show, for privacy. */
  masked: boolean;
  markers: RatingMarker[];
}

const DEFAULT_MARKER_COLOR = "#1C64F2";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#FBBF24", // Gul/gull for rating
  reference: "rgba(255, 255, 255, 0.2)",
  text: "rgba(255, 255, 255, 0.7)",
};

const CHART_COLORS_LIGHT = {
  primary: "#D97706", // Amber 600 - darker gold for light mode
  reference: "rgba(0, 0, 0, 0.2)",
  text: "#262626", // Nav Gray 90
};

type RatingTrendState =
  | { status: "pending" }
  | { status: "error" }
  | {
      status: "ready";
      data: TrendPoint[];
      interval: TimeInterval;
      metric: ReturnType<typeof questionTrendRatingMetric>;
      overallAverage: number | undefined;
      /** The value for the whole period, as the cards above write it. */
      overallFormatted: string | undefined;
    };

/**
 * The rating trend per day, ISO week or month, with the markers in the
 * bucket of their date, as the chart and its table show it.
 */
function useRatingTrend(markers: RatingMarker[]): RatingTrendState {
  const { data: stats, isPending, isPlaceholderData } = useStats();
  const { params } = useSearchParams();
  const interval = chooseInterval(params.fromDate, params.toDate);
  const fields =
    stats?.fieldStats?.filter((field) => field.fieldType === "RATING") ?? [];
  const field =
    !isPlaceholderData && fields.length === 1 ? fields[0] : undefined;
  const trendQuery = useQuestionTrend(Boolean(field), field?.fieldId, interval);

  if (isPending || isPlaceholderData || (field && trendQuery.isPending)) {
    return { status: "pending" };
  }
  if (trendQuery.isError) return { status: "error" };

  const trend = trendQuery.data;
  const metric = questionTrendRatingMetric(trend ?? {});
  const trendByStart = new Map(
    (trend?.buckets ?? []).map((bucket) => [bucket.startDate, bucket]),
  );
  const markersByBucket = groupMarkersByDate(markers, interval);

  const inPeriod = ratingTrendBuckets({
    fromDate: params.fromDate,
    toDate: params.toDate,
    interval,
    today: todayInOslo(),
    latestAnswered: (trend?.buckets ?? [])
      .map((bucket) => bucket.startDate)
      .sort()
      .at(-1),
    markerDates: markers.map((marker) => marker.markerDate),
  });
  // Without a period, show the buckets that have answers or markers.
  const buckets: TimeBucket[] =
    inPeriod.length > 0
      ? inPeriod
      : Array.from(
          new Set([...trendByStart.keys(), ...Object.keys(markersByBucket)]),
        )
          .sort((a, b) => a.localeCompare(b))
          .map((start) => calendarBucket(start, interval));
  const withYear = spansSeveralYears(buckets);

  const data: TrendPoint[] = buckets.map((bucket) => {
    const trendBucket = trendByStart.get(bucket.start);
    return {
      date: bucket.start,
      from: bucket.from,
      to: bucket.to,
      tick: formatBucketTick(bucket, interval, withYear),
      label: formatBucketLabel(bucket, interval),
      partial: bucket.partial,
      average:
        trend && trendBucket
          ? questionTrendRatingValue(trend, trendBucket)
          : null,
      count: trendBucket?.responseCount ?? 0,
      masked: trendBucket?.masked ?? false,
      markers: markersByBucket[bucket.start] ?? [],
    };
  });
  const overall =
    field && ratingResponseCount(field) ? getRatingMetric(field) : undefined;

  return {
    status: "ready",
    data,
    interval,
    metric,
    overallAverage: overall?.value,
    overallFormatted: overall?.formatted,
  };
}

/**
 * The buckets of the period up to today. Answers dated after the browser's
 * today still count, in case its clock is behind. A marker can be set on a
 * later day in the period: the axis then goes on to its bucket. The buckets
 * up to today keep their partial marks, and the later ones are clipped to
 * the period only.
 */
export function ratingTrendBuckets({
  fromDate,
  toDate,
  interval,
  today,
  latestAnswered,
  markerDates,
}: {
  fromDate?: string;
  toDate?: string;
  interval: TimeInterval;
  today: string;
  latestAnswered?: string;
  markerDates: string[];
}): TimeBucket[] {
  const answered = periodBuckets(
    fromDate,
    toDate,
    interval,
    laterDate(today, latestAnswered),
  );
  const lastAnswered = answered.at(-1);
  const lastMarkerDate = markerDates
    .filter((date) => !toDate || date <= toDate)
    .sort()
    .at(-1);
  if (!lastAnswered || !lastMarkerDate || lastMarkerDate <= lastAnswered.end) {
    return answered;
  }

  const markerBucketEnd = calendarBucket(
    bucketStart(lastMarkerDate, interval),
    interval,
  ).end;
  const ahead = periodBuckets(
    fromDate,
    toDate,
    interval,
    toDate && toDate < markerBucketEnd ? toDate : markerBucketEnd,
  ).filter((bucket) => bucket.start > lastAnswered.start);
  return [...answered, ...ahead];
}

/** True when nothing in the period has an answer or a marker. */
function isEmptyTrend(data: TrendPoint[]): boolean {
  return data.every(
    (point) =>
      point.average === null && !point.masked && point.markers.length === 0,
  );
}

/**
 * The chart's numbers and markers, under the chart. Days, weeks and months
 * without answers are left out unless they have a marker, as the chart shows
 * no point for them.
 */
export function RatingTrendChartTable({ markers = [] }: RatingTrendChartProps) {
  const trend = useRatingTrend(markers);
  const { params } = useSearchParams();
  // The trend has no placeholder data, so it is pending after each filter
  // change. Keep an opened table open meanwhile.
  const hadRows = useRef(false);

  if (trend.status === "pending") {
    const nouns =
      INTERVAL_NOUNS[chooseInterval(params.fromDate, params.toDate)];
    return hadRows.current ? (
      <ChartDataTable
        label={`Vurdering per ${nouns.one}`}
        rowHeader={nouns.rowHeader}
        columns={[]}
        rows={[]}
        loading
      />
    ) : null;
  }
  if (trend.status === "error") {
    hadRows.current = false;
    return null;
  }

  const { metric } = trend;
  const nouns = INTERVAL_NOUNS[trend.interval];
  const rows = trend.data.filter(
    (point) =>
      point.average !== null || point.masked || point.markers.length > 0,
  );
  hadRows.current = rows.length > 0;
  if (rows.length === 0) return null;

  return (
    <ChartDataTable
      label={`${ratingTrendTitle(metric.label)} per ${nouns.one}`}
      rowHeader={nouns.rowHeader}
      columns={[
        { label: metric.label },
        { label: "Svar" },
        { label: "Markører", align: "left" },
      ]}
      rows={rows.map((point) => ({
        key: point.date,
        header: point.label,
        cells: [
          point.masked
            ? "Skjult"
            : point.average === null
              ? "–"
              : `${point.average.toLocaleString("no-NO", {
                  maximumFractionDigits: 1,
                })}${metric.unit ?? ""}`,
          point.masked ? "Skjult" : point.count.toLocaleString("no-NO"),
          point.markers.map((marker) => marker.label).join(", ") || "–",
        ],
      }))}
    />
  );
}

export function RatingTrendChart({ markers = [] }: RatingTrendChartProps) {
  const trend = useRatingTrend(markers);
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { theme } = useTheme();
  const { isMobile } = useBreakpoint();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (trend.status === "pending") {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (trend.status === "error")
    return (
      <Alert variant="warning" size="small">
        Kunne ikke hente utviklingen i vurderinger.
      </Alert>
    );

  const { data, interval, metric, overallAverage, overallFormatted } = trend;
  const nouns = INTERVAL_NOUNS[interval];

  if (isEmptyTrend(data)) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  const tickByDate = new Map(data.map((point) => [point.date, point.tick]));

  const markerLabelMeta = buildMarkerLabelMeta(markers, interval);
  const maxMarkerLabelOffset = Math.max(
    0,
    ...Array.from(markerLabelMeta.values()).map((meta) => meta.offsetY),
  );
  const chartMarginTop = Math.max(24, maxMarkerLabelOffset + 24);
  const chartMargin = isMobile
    ? { top: chartMarginTop, right: 16, left: 8, bottom: 20 }
    : { top: chartMarginTop, right: 20, left: 12, bottom: 20 };

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <LineChart
        data={data}
        margin={chartMargin}
        role="img"
        aria-label={`Linjediagram som viser ${inSentence(metric.label)} per ${nouns.one}${overallFormatted ? `. Hele perioden: ${overallFormatted}` : ""}`}
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
              ? data[index]
              : typeof state.activeLabel === "string"
                ? data.find((d) => d.date === state.activeLabel)
                : undefined;

          if (!clickData) return;
          if (typeof clickData.average !== "number") return;

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
              lowRating: undefined,
            },
          });
        }}
        className={styles.chartClickable}
      >
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
          tickFormatter={(date: string) => tickByDate.get(date) ?? date}
        />

        <YAxis
          domain={metric.domain}
          unit={metric.unit}
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width={20}
          hide={isMobile}
        />

        {typeof overallAverage === "number" && (
          <ReferenceLine
            y={overallAverage}
            stroke={colors.reference}
            strokeDasharray="3 3"
          />
        )}

        {markers.map((marker) => {
          const color = marker.color ?? DEFAULT_MARKER_COLOR;
          const labelMeta = markerLabelMeta.get(marker.id);

          return (
            <ReferenceLine
              key={marker.id}
              x={bucketStart(marker.markerDate, interval)}
              stroke={color}
              strokeDasharray="4 4"
              label={
                labelMeta
                  ? {
                      value: labelMeta.text,
                      angle: 0,
                      position: "top",
                      offset: labelMeta.offsetY,
                      fill: color,
                      fontSize: 14,
                      fontWeight: 600,
                    }
                  : undefined
              }
            />
          );
        })}

        <Tooltip
          cursor={{ stroke: colors.reference, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0 || !payload[0]) {
              return null;
            }

            const point = payload[0].payload as TrendPoint;
            const average = point.average;

            return (
              <div className={styles.tooltipCard}>
                <div className={styles.tooltipTitle}>{point.label}</div>

                {average !== null && (
                  <div className={styles.tooltipRow}>
                    {metric.variant === "emoji" ? (
                      <span className={styles.tooltipEmojiLarge}>
                        {ratingToEmoji(Math.round(average))}
                      </span>
                    ) : null}
                    <span className={styles.tooltipStrong}>
                      {average.toLocaleString("nb-NO", {
                        maximumFractionDigits: 1,
                      })}
                      {metric.unit}
                    </span>
                    <span className={styles.tooltipMuted}>
                      ({point.count} svar)
                    </span>
                  </div>
                )}

                {average === null && (
                  <div className={styles.tooltipMuted}>
                    {point.masked
                      ? `For få svar til å vises ${nouns.this}`
                      : `Ingen svar ${nouns.this}`}
                  </div>
                )}

                {point.markers.length > 0 && (
                  <div className={styles.tooltipMarkerSection}>
                    {point.markers.map((marker) => (
                      <div key={marker.id}>
                        <div className={styles.tooltipMarkerRow}>
                          <span
                            className={styles.tooltipMarkerDot}
                            style={{
                              backgroundColor:
                                marker.color ?? DEFAULT_MARKER_COLOR,
                            }}
                          />
                          <span className={styles.tooltipStrong}>
                            {marker.label}
                          </span>
                        </div>
                        {marker.description && (
                          <div className={styles.tooltipMuted}>
                            {marker.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {average !== null && (
                  <div className={styles.tooltipHint}>
                    Klikk for å åpne tilbakemeldinger
                  </div>
                )}
              </div>
            );
          }}
        />

        <Line
          type="linear"
          dataKey="average"
          connectNulls
          stroke={colors.primary}
          strokeWidth={2}
          dot={(props: {
            cx?: number;
            cy?: number;
            index?: number;
            payload?: TrendPoint;
          }) => {
            const { cx, cy, index, payload } = props;
            if (typeof cx !== "number" || typeof cy !== "number") {
              return <g key={`empty-${index}`} />;
            }
            // A week or month only partly in the period gets a hollow dot.
            const partial = payload?.partial ?? false;
            return (
              <circle
                key={payload?.date ?? index}
                cx={cx}
                cy={cy}
                r={4}
                fill={partial ? "var(--ax-bg-raised)" : colors.primary}
                stroke={colors.primary}
                strokeWidth={partial ? 2 : 0}
              />
            );
          }}
          activeDot={{
            fill: colors.primary,
            strokeWidth: 2,
            stroke: "#fff",
            r: 6,
          }}
        />
      </LineChart>
    </ResponsiveContainerWithInitialSize>
  );
}

/** Names the partial weeks or months that have answers, under the chart. */
export function RatingTrendPartialNote({
  markers = [],
}: RatingTrendChartProps) {
  const trend = useRatingTrend(markers);
  if (trend.status !== "ready" || isEmptyTrend(trend.data)) return null;

  const note = describePartialBuckets(
    trend.data
      .filter((point) => point.partial && point.average !== null)
      .map((point) => point.date),
    trend.interval,
    "hul prikk",
  );
  return note ? <Detail textColor="subtle">{note}</Detail> : null;
}

/** Lower case in a sentence, except for names in capitals such as NPS. */
function inSentence(label: string): string {
  return label === label.toUpperCase() ? label : label.toLowerCase();
}

/** Markers by the first day of the day, week or month they belong to. */
export function groupMarkersByDate(
  markers: RatingMarker[],
  interval: TimeInterval = "day",
): Record<string, RatingMarker[]> {
  const grouped: Record<string, RatingMarker[]> = {};

  for (const marker of markers) {
    const key = bucketStart(marker.markerDate, interval);
    const existing = grouped[key] ?? [];
    existing.push(marker);
    grouped[key] = existing;
  }

  for (const key of Object.keys(grouped)) {
    grouped[key]?.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return grouped;
}

/** Distance in days, weeks or months between two buckets' first days. */
function bucketDistance(a: string, b: string, interval: TimeInterval): number {
  if (interval === "month") return dayjs(b).diff(dayjs(a), "month");
  const days = dayjs(b).diff(dayjs(a), "day");
  return interval === "week" ? Math.round(days / 7) : days;
}

/**
 * Stacks the labels of markers that are close on the time axis: within two
 * days, weeks or months of the first marker in the group, as the axis shows
 * them. A group never spans more than three of them, so markers that come
 * every week keep their labels.
 */
export function buildMarkerLabelMeta(
  markers: RatingMarker[],
  interval: TimeInterval = "day",
): Map<string, MarkerLabelMeta> {
  const sorted = [...markers].sort((a, b) => {
    const byDate = a.markerDate.localeCompare(b.markerDate);
    if (byDate !== 0) return byDate;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const clusters: RatingMarker[][] = [];

  for (const marker of sorted) {
    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster) {
      clusters.push([marker]);
      continue;
    }

    const firstInCluster = currentCluster[0];
    if (!firstInCluster) {
      currentCluster.push(marker);
      continue;
    }

    const distance = bucketDistance(
      bucketStart(firstInCluster.markerDate, interval),
      bucketStart(marker.markerDate, interval),
      interval,
    );

    if (distance <= 2) {
      currentCluster.push(marker);
    } else {
      clusters.push([marker]);
    }
  }

  const labelMeta = new Map<string, MarkerLabelMeta>();

  for (const cluster of clusters) {
    cluster.slice(0, 3).forEach((marker, index) => {
      const overflowCount = cluster.length - 3;
      const text =
        index === 2 && overflowCount > 0
          ? `...+${overflowCount}`
          : marker.label;

      labelMeta.set(marker.id, {
        offsetY: 10 + index * 20,
        text,
      });
    });
  }

  return labelMeta;
}

function ratingToEmoji(rating: number): string {
  switch (rating) {
    case 1:
      return "😡";
    case 2:
      return "🙁";
    case 3:
      return "😐";
    case 4:
      return "😀";
    case 5:
      return "😍";
    default:
      return "❓";
  }
}
