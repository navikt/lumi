import { useCallback, useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import {
  formatCount,
  PartialDot,
} from "~/components/shared/Charts/timeSeriesParts";
import type { QuestionTrendResponse } from "~/types/api";
import { INTERVAL_NOUNS } from "~/utils/timeBuckets";
import styles from "./QuestionTrendSection.module.css";
import {
  inSentence,
  type QuestionPoint,
  questionTrendChartData,
  questionTrendRatingMetric,
} from "./questionTrendUtils";

const SERIES_COLORS = [
  "#0067c5",
  "#a86400",
  "#06893a",
  "#c30000",
  "#7c3aed",
  "#007c83",
  "#c13c8a",
  "#5c6a78",
];

interface QuestionTrendChartProps {
  trend: QuestionTrendResponse;
  points: QuestionPoint[];
  measure: "count" | "percentage";
}

export function QuestionTrendChart({
  trend,
  points,
  measure,
}: QuestionTrendChartProps) {
  const isRating = trend.fieldType === "RATING";
  const metric = useMemo(() => questionTrendRatingMetric(trend), [trend]);
  const chartData = useMemo(
    () => questionTrendChartData(trend, points, measure),
    [trend, points, measure],
  );
  const labelByTick = useMemo(
    () => new Map(chartData.map((point) => [point.tick, point.label])),
    [chartData],
  );
  const labelFormatter = useCallback(
    (tick: unknown) => labelByTick.get(String(tick)) ?? String(tick),
    [labelByTick],
  );
  const unit = INTERVAL_NOUNS[trend.interval].one;
  const ariaLabel = isRating
    ? `Linjediagram for ${trend.label}, med ${inSentence(metric.label)} per ${unit}. Tabellen under viser de samme tallene.`
    : `Linjediagram for ${trend.label}, med ${measure === "count" ? "antall" : "andel"} respondenter per svaralternativ og ${unit}. Tabellen under viser de samme tallene.`;

  return (
    <div className={styles.chartViewport}>
      <div className={styles.chart}>
        <ResponsiveContainerWithInitialSize width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 24, bottom: 12, left: 4 }}
            role="img"
            aria-label={ariaLabel}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="tick" tickLine={false} minTickGap={24} />
            <YAxis
              allowDecimals={isRating}
              domain={isRating ? metric.domain : [0, "auto"]}
              tickLine={false}
              unit={
                isRating
                  ? metric.unit
                  : measure === "percentage"
                    ? "%"
                    : undefined
              }
              width="auto"
              tickFormatter={formatCount}
            />
            <Tooltip labelFormatter={labelFormatter} />
            {!isRating && <Legend />}
            {isRating ? (
              <Line
                type="linear"
                dataKey="average"
                name={metric.label}
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                connectNulls={false}
                dot={PartialDot}
                unit={metric.unit}
              />
            ) : (
              trend.options.map((option, index) => (
                <Line
                  key={option.id}
                  type="linear"
                  dataKey={`values.${index}`}
                  name={option.label}
                  stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                  strokeWidth={2}
                  connectNulls={false}
                  dot={PartialDot}
                  unit={measure === "percentage" ? "%" : undefined}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainerWithInitialSize>
      </div>
    </div>
  );
}
