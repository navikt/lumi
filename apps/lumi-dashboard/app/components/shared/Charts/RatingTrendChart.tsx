import { Alert, Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
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
} from "~/components/dashboard/sections/FieldStats/PeriodComparison/model";
import {
  fillQuestionTrendBuckets,
  questionTrendRatingMetric,
  questionTrendRatingValue,
} from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { RatingMarker } from "~/types/api";
import styles from "./Charts.module.css";

interface RatingTrendChartProps {
  markers?: RatingMarker[];
}

interface MarkerLabelMeta {
  offsetY: number;
  text: string;
}

interface TrendPoint {
  date: string;
  average: number | null;
  count: number;
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

export function RatingTrendChart({ markers = [] }: RatingTrendChartProps) {
  const { data: stats, isPending, isPlaceholderData } = useStats();
  const fields =
    stats?.fieldStats?.filter((field) => field.fieldType === "RATING") ?? [];
  const field =
    !isPlaceholderData && fields.length === 1 ? fields[0] : undefined;
  const trendQuery = useQuestionTrend(Boolean(field), field?.fieldId, "day");
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { theme } = useTheme();
  const { isMobile } = useBreakpoint();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending || isPlaceholderData || (field && trendQuery.isPending)) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  if (trendQuery.isError)
    return (
      <Alert variant="warning" size="small">
        Kunne ikke hente utviklingen i vurderinger.
      </Alert>
    );
  const trend = trendQuery.data;
  const metric = questionTrendRatingMetric(trend ?? {});
  const buckets = trend
    ? fillQuestionTrendBuckets(trend, params.fromDate, params.toDate)
    : [];
  const ratingByDate = Object.fromEntries(
    buckets.map((bucket) => [
      bucket.startDate,
      {
        average: trend ? questionTrendRatingValue(trend, bucket) : null,
        count: bucket.responseCount ?? 0,
      },
    ]),
  );
  const markersByDate = groupMarkersByDate(markers);

  const allDates = Array.from(
    new Set([...Object.keys(ratingByDate), ...Object.keys(markersByDate)]),
  ).sort((a, b) => a.localeCompare(b));

  const data: TrendPoint[] = allDates.map((date) => {
    const rating = ratingByDate[date];
    return {
      date,
      average: rating?.average ?? null,
      count: rating?.count ?? 0,
      markers: markersByDate[date] ?? [],
    };
  });

  if (data.length === 0) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  const markerLabelMeta = buildMarkerLabelMeta(markers);
  const maxMarkerLabelOffset = Math.max(
    0,
    ...Array.from(markerLabelMeta.values()).map((meta) => meta.offsetY),
  );
  const chartMarginTop = Math.max(24, maxMarkerLabelOffset + 24);
  const chartMargin = isMobile
    ? { top: chartMarginTop, right: 16, left: 8, bottom: 20 }
    : { top: chartMarginTop, right: 20, left: 12, bottom: 20 };
  const overallAverage =
    field && ratingResponseCount(field)
      ? getRatingMetric(field).value
      : undefined;

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
        aria-label={`Linjediagram som viser ${metric.label.toLowerCase()} over tid${typeof overallAverage === "number" ? `. Valgt periode: ${overallAverage.toLocaleString("nb-NO")}` : ""}`}
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

          navigate({
            to: "/feedback",
            search: {
              ...params,
              dateMode: "fixed",
              fromDate: clickData.date,
              toDate: clickData.date,
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
          tickFormatter={(value) => dayjs(value).format("DD.MM")}
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
              x={marker.markerDate}
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
                <div className={styles.tooltipTitle}>
                  {dayjs(point.date).format("DD. MMMM YYYY")}
                </div>

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
                    Ingen rating-svar denne dagen
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
          type="monotone"
          dataKey="average"
          connectNulls
          stroke={colors.primary}
          strokeWidth={2}
          dot={{ fill: colors.primary, strokeWidth: 0, r: 4 }}
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

export function groupMarkersByDate(
  markers: RatingMarker[],
): Record<string, RatingMarker[]> {
  const grouped: Record<string, RatingMarker[]> = {};

  for (const marker of markers) {
    const existing = grouped[marker.markerDate] ?? [];
    existing.push(marker);
    grouped[marker.markerDate] = existing;
  }

  for (const key of Object.keys(grouped)) {
    grouped[key]?.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return grouped;
}

export function buildMarkerLabelMeta(
  markers: RatingMarker[],
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

    const lastInCluster = currentCluster[currentCluster.length - 1];
    if (!lastInCluster) {
      currentCluster.push(marker);
      continue;
    }

    const dayDistance = dayjs(marker.markerDate).diff(
      dayjs(lastInCluster.markerDate),
      "day",
    );

    if (dayDistance <= 2) {
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
