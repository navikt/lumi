import { Alert, Detail, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  getRatingMetric,
  ratingResponseCount,
  ratingTrendTitle,
} from "~/components/dashboard/sections/FieldStats/PeriodComparison/model";
import {
  inSentence,
  questionTrendRatingMetric,
  questionTrendRatingValue,
} from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import { BucketLink } from "~/components/shared/Charts/BucketLink";
import { ChartDataTable } from "~/components/shared/Charts/ChartDataTable";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSeriesWindow } from "~/hooks/useSeriesWindow";
import { useStats } from "~/hooks/useStats";
import type { QuestionTrendResponse, RatingMarker } from "~/types/api";
import {
  type AxisBucket,
  bucketDistance,
  bucketStart,
  buildTimeAxis,
  describePartialBuckets,
  INTERVAL_NOUNS,
  type TimeAxis,
  type TimeInterval,
} from "~/utils/timeBuckets";
import styles from "./Charts.module.css";
import {
  activePoint,
  activePointIndex,
  bucketFeedbackSearch,
  DrilldownHint,
  PARTIAL_DOT_LOOK,
  PartialDot,
  useTapGuard,
} from "./timeSeriesParts";

interface MarkerLabelMeta {
  offsetY: number;
  text: string;
}

export interface RatingPoint extends AxisBucket {
  average: number | null;
  count: number;
  /** Too few answers to show, for privacy. */
  masked: boolean;
  markers: RatingMarker[];
}

export interface RatingSeries {
  interval: TimeInterval;
  withYear: boolean;
  points: RatingPoint[];
  /**
   * Markers in the period dated before the axis begins, which the chart
   * does not show. The axis begins after the period when answers have been
   * deleted, or with the first answer when the period has no start.
   */
  earlierMarkers: RatingMarker[];
  /** Markers dated after the axis ends, which the chart does not show. */
  laterMarkers: RatingMarker[];
}

export type RatingTrendState =
  | { status: "pending" }
  | { status: "error" }
  | {
      status: "ready";
      series: RatingSeries;
      metric: ReturnType<typeof questionTrendRatingMetric>;
      overallAverage: number | undefined;
      /** The value for the whole period, as the cards above write it. */
      overallFormatted: string | undefined;
    };

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

/** By date, and by when they were made for markers on the same date. */
function compareMarkers(a: RatingMarker, b: RatingMarker): number {
  return (
    a.markerDate.localeCompare(b.markerDate) ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

/** Markers grouped by the day, week or month of their date, keyed by its first day. */
export function groupMarkersByBucket(
  markers: RatingMarker[],
  interval: TimeInterval,
): Map<string, RatingMarker[]> {
  const grouped = new Map<string, RatingMarker[]>();
  for (const marker of [...markers].sort(compareMarkers)) {
    const key = bucketStart(marker.markerDate, interval);
    grouped.set(key, [...(grouped.get(key) ?? []), marker]);
  }
  return grouped;
}

/**
 * The rating trend on the axis, with each marker in the bucket of its date.
 * Markers before and after the axis are kept apart.
 */
export function ratingSeries(
  axis: TimeAxis | undefined,
  trend: QuestionTrendResponse | undefined,
  markers: RatingMarker[],
  today?: string,
): RatingSeries {
  const buckets = axis?.buckets ?? [];
  // Without an axis, as before a period has begun, markers after today are
  // still named under the chart.
  const lastDay = buckets.at(-1)?.lastDay ?? today;
  const firstDay = buckets[0]?.firstDay;
  const onAxis = markers.filter(
    (marker) =>
      firstDay !== undefined &&
      lastDay !== undefined &&
      marker.markerDate >= firstDay &&
      marker.markerDate <= lastDay,
  );
  const earlierMarkers = markers
    .filter((marker) => firstDay !== undefined && marker.markerDate < firstDay)
    .sort(compareMarkers);
  const laterMarkers = markers
    .filter((marker) => lastDay !== undefined && marker.markerDate > lastDay)
    .sort(compareMarkers);
  const interval = axis?.interval ?? "day";
  const markersByBucket = groupMarkersByBucket(onAxis, interval);
  const trendByStart = new Map(
    (trend?.buckets ?? []).map((bucket) => [bucket.startDate, bucket]),
  );

  return {
    interval,
    withYear: axis?.withYear ?? false,
    earlierMarkers,
    laterMarkers,
    points: buckets.map((bucket) => {
      const trendBucket = trendByStart.get(bucket.start);
      return {
        ...bucket,
        average:
          trend && trendBucket
            ? questionTrendRatingValue(trend, trendBucket)
            : null,
        count: trendBucket?.responseCount ?? 0,
        masked: trendBucket?.masked ?? false,
        markers: markersByBucket.get(bucket.start) ?? [],
      };
    }),
  };
}

/**
 * The rating trend for the page's window. The card computes it once and
 * passes it to the chart, the notes and the table. The trend comes from the
 * API with the window's resolution, and the API computes each week's or
 * month's average from all its answers. Nothing is fetched until `enabled`
 * is true, as for a page that does not show the card.
 */
export function useRatingSeries(
  markers: RatingMarker[],
  enabled: boolean,
): RatingTrendState {
  const { data: stats, isPending, isPlaceholderData } = useStats();
  const { window, interval, today } = useSeriesWindow();
  const fields =
    stats?.fieldStats?.filter((field) => field.fieldType === "RATING") ?? [];
  const field =
    enabled && !isPlaceholderData && fields.length === 1
      ? fields[0]
      : undefined;
  const trendQuery = useQuestionTrend(
    Boolean(field && window),
    field?.fieldId,
    interval,
  );
  const trend = trendQuery.data;

  const series = useMemo(
    () =>
      ratingSeries(
        window ? buildTimeAxis(window, trend?.interval ?? interval) : undefined,
        trend,
        markers,
        today,
      ),
    [window, interval, trend, markers, today],
  );
  const metric = useMemo(() => questionTrendRatingMetric(trend ?? {}), [trend]);
  const overall = useMemo(
    () =>
      field && ratingResponseCount(field) ? getRatingMetric(field) : undefined,
    [field],
  );

  if (
    isPending ||
    isPlaceholderData ||
    (field && window && trendQuery.isPending)
  ) {
    return { status: "pending" };
  }
  if (trendQuery.isError) return { status: "error" };

  return {
    status: "ready",
    series,
    metric,
    overallAverage: overall?.value,
    overallFormatted: overall?.formatted,
  };
}

/** True when a point has an answer, hidden answers or a marker to show. */
function hasContent(point: RatingPoint): boolean {
  return point.average !== null || point.masked || point.markers.length > 0;
}

/**
 * The chart's numbers and markers, under the chart. Days, weeks and months
 * without answers are left out unless they have a marker, as the chart shows
 * no point for them.
 */
export function RatingTrendChartTable({ trend }: { trend: RatingTrendState }) {
  const { params } = useSearchParams();
  // The trend has no placeholder data, so it is pending after each filter
  // change. Keep an opened table open meanwhile, under the same name.
  const shown = useRef<{ label: string; rowHeader: string } | undefined>(
    undefined,
  );

  if (trend.status === "pending") {
    return shown.current ? (
      <ChartDataTable
        label={shown.current.label}
        rowHeader={shown.current.rowHeader}
        columns={[]}
        rows={[]}
        loading
      />
    ) : null;
  }
  if (trend.status === "error") {
    shown.current = undefined;
    return null;
  }

  const { metric, series } = trend;
  const nouns = INTERVAL_NOUNS[series.interval];
  const rows = series.points.filter(hasContent);
  const label = `${ratingTrendTitle(metric.label)} per ${nouns.one}`;
  shown.current =
    rows.length > 0 ? { label, rowHeader: nouns.rowHeader } : undefined;
  if (rows.length === 0) return null;

  return (
    <ChartDataTable
      label={label}
      rowHeader={nouns.rowHeader}
      columns={[
        { label: metric.label },
        { label: "Svar" },
        { label: "Markører", align: "left" },
      ]}
      rows={rows.map((point) => ({
        key: point.start,
        // As in the chart, only a bucket with an average opens Tilbakemeldinger.
        header:
          typeof point.average === "number" ? (
            <BucketLink search={bucketFeedbackSearch(params, point)}>
              {point.label}
            </BucketLink>
          ) : (
            point.label
          ),
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

export function RatingTrendChart({ trend }: { trend: RatingTrendState }) {
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { theme } = useTheme();
  const { isMobile } = useBreakpoint();
  const [hovered, setHovered] = useState<number>();
  const tapGuard = useTapGuard();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;
  const ready = trend.status === "ready" ? trend : undefined;
  const metric = ready?.metric;

  const renderTooltip = useCallback(
    ({ active, payload }: TooltipContentProps) => {
      const point = active
        ? (payload?.[0]?.payload as RatingPoint | undefined)
        : undefined;
      if (!point || !metric) return null;
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
              <span className={styles.tooltipMuted}>({point.count} svar)</span>
            </div>
          )}

          {average === null && (
            <div className={styles.tooltipMuted}>
              {point.masked ? "For få svar til å vises" : "Ingen svar"}
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
                        backgroundColor: marker.color ?? DEFAULT_MARKER_COLOR,
                      }}
                    />
                    <span className={styles.tooltipStrong}>{marker.label}</span>
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

          {average !== null && <DrilldownHint className={styles.tooltipHint} />}
        </div>
      );
    },
    [metric],
  );

  if (trend.status === "pending") {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (trend.status === "error")
    return (
      <Alert variant="warning" size="small">
        Kunne ikke hente utviklingen i vurderinger.
      </Alert>
    );

  const { series, overallAverage, overallFormatted } = trend;
  const { points } = series;
  const nouns = INTERVAL_NOUNS[series.interval];

  if (!points.some(hasContent)) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  const tickByStart = new Map(points.map((point) => [point.start, point.tick]));
  const markers = points.flatMap((point) => point.markers);
  const markerLabelMeta = buildMarkerLabelMeta(markers, series.interval);
  const maxMarkerLabelOffset = Math.max(
    0,
    ...Array.from(markerLabelMeta.values()).map((meta) => meta.offsetY),
  );
  const chartMarginTop = Math.max(24, maxMarkerLabelOffset + 24);
  const chartMargin = isMobile
    ? { top: chartMarginTop, right: 16, left: 8, bottom: 20 }
    : { top: chartMarginTop, right: 20, left: 12, bottom: 20 };
  // Points without answers open nothing and keep the arrow.
  const pointsAtAnswers =
    hovered !== undefined && typeof points[hovered]?.average === "number";

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <LineChart
        data={points}
        margin={chartMargin}
        role="img"
        aria-label={`Linjediagram som viser ${inSentence(ratingTrendTitle(trend.metric.label))} per ${nouns.one}${overallFormatted ? `. Hele perioden: ${overallFormatted}` : ""}`}
        onClick={(state, event) => {
          const point = activePoint(points, state);
          if (typeof point?.average !== "number" || tapGuard.isTap(event)) {
            return;
          }
          navigate({
            to: "/feedback",
            search: bucketFeedbackSearch(params, point),
          });
        }}
        onTouchStart={tapGuard.onTouchStart}
        onTouchEnd={tapGuard.onTouchEnd}
        onMouseMove={(state) => setHovered(activePointIndex(state))}
        onMouseLeave={() => setHovered(undefined)}
        // recharts sets cursor: default on its wrapper, so a class loses.
        style={{ cursor: pointsAtAnswers ? "pointer" : "default" }}
        // Keyboards use the table under the chart, where every bucket with
        // an average is a link.
        accessibilityLayer={false}
      >
        <XAxis
          dataKey="tick"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />

        <YAxis
          domain={trend.metric.domain}
          unit={trend.metric.unit}
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width="auto"
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
              x={tickByStart.get(
                bucketStart(marker.markerDate, series.interval),
              )}
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

        {/* The tooltip also names weeks without an average, and their
            markers. By default recharts leaves out points without a value. */}
        <Tooltip
          cursor={{ stroke: colors.reference, strokeDasharray: "3 3" }}
          content={renderTooltip}
          filterNull={false}
        />

        <Line
          type="linear"
          dataKey="average"
          connectNulls
          stroke={colors.primary}
          strokeWidth={2}
          dot={PartialDot}
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

/** Names the partial weeks or months that have a point, under the chart. */
export function RatingTrendPartialNote({ trend }: { trend: RatingTrendState }) {
  if (trend.status !== "ready") return null;
  const { series } = trend;
  const note = describePartialBuckets(
    series.points.filter((point) => point.partial && point.average !== null),
    series.interval,
    PARTIAL_DOT_LOOK,
    series.withYear,
  );
  return note ? <Detail textColor="subtle">{note}</Detail> : null;
}

function markersOffAxis(count: number, when: string): string | undefined {
  if (count === 0) return undefined;
  const markers = count === 1 ? "1 markør" : `${count} markører`;
  return `${markers} har dato ${when} og står bare i listen Markører.`;
}

/**
 * Says which markers the chart cannot show, under the chart. They are still
 * in the list.
 */
export function RatingTrendMarkersOffAxis({
  trend,
}: {
  trend: RatingTrendState;
}) {
  if (trend.status !== "ready") return null;
  const notes = [
    markersOffAxis(trend.series.earlierMarkers.length, "før grafen begynner"),
    markersOffAxis(trend.series.laterMarkers.length, "etter i dag"),
  ].filter(Boolean);
  if (notes.length === 0) return null;
  return <Detail textColor="subtle">{notes.join(" ")}</Detail>;
}

/** Labels in one row stand at least this many buckets apart. */
const LABEL_GAP = 3;
const LABEL_ROWS = 3;

/**
 * Places the marker labels in up to three rows above the chart. Each label
 * takes the lowest row whose last label is at least three days, weeks or
 * months away, as the axis shows them. When no row is free, the label in the
 * top row nearby becomes «...+N» for the markers it stands for.
 */
export function buildMarkerLabelMeta(
  markers: RatingMarker[],
  interval: TimeInterval = "day",
): Map<string, MarkerLabelMeta> {
  const rows: (RatingMarker | undefined)[] = Array(LABEL_ROWS).fill(undefined);
  const labelMeta = new Map<string, MarkerLabelMeta>();
  const hiddenNear = new Map<string, number>();

  for (const marker of [...markers].sort(compareMarkers)) {
    const start = bucketStart(marker.markerDate, interval);
    const row = rows.findIndex(
      (last) =>
        !last ||
        bucketDistance(
          bucketStart(last.markerDate, interval),
          start,
          interval,
        ) >= LABEL_GAP,
    );
    if (row >= 0) {
      rows[row] = marker;
      labelMeta.set(marker.id, { offsetY: 10 + row * 20, text: marker.label });
      continue;
    }
    const top = rows[LABEL_ROWS - 1];
    if (top) hiddenNear.set(top.id, (hiddenNear.get(top.id) ?? 1) + 1);
  }

  for (const [id, count] of hiddenNear) {
    const meta = labelMeta.get(id);
    if (meta) labelMeta.set(id, { ...meta, text: `...+${count}` });
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
