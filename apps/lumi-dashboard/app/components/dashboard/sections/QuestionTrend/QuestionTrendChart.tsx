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
import type { QuestionTrendBucket, QuestionTrendResponse } from "~/types/api";
import { INTERVAL_NOUNS } from "~/utils/timeBuckets";
import styles from "./QuestionTrendSection.module.css";
import {
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
  buckets: QuestionTrendBucket[];
  measure: "count" | "percentage";
  /** The bucket's full name, for the tooltip and the table. */
  labelFor?: (startDate: string) => string;
  /** The bucket's short name on the time axis. */
  tickFor?: (startDate: string) => string;
}

export function QuestionTrendChart({
  trend,
  buckets,
  measure,
  labelFor,
  tickFor,
}: QuestionTrendChartProps) {
  const isRating = trend.fieldType === "RATING";
  const metric = questionTrendRatingMetric(trend);
  const chartData = questionTrendChartData(trend, buckets, measure, labelFor);
  const labelByStart = new Map(
    chartData.map((point) => [point.start, point.label]),
  );
  const unit = INTERVAL_NOUNS[trend.interval].one;
  const metricName =
    metric.label === metric.label.toUpperCase()
      ? metric.label
      : metric.label.toLowerCase();
  const ariaLabel = isRating
    ? `Linjediagram for ${trend.label}, med ${metricName} per ${unit}. Tabellen under viser de samme tallene.`
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
            <XAxis
              dataKey="start"
              tickLine={false}
              minTickGap={24}
              tickFormatter={(start: string) =>
                tickFor?.(start) ?? labelByStart.get(start) ?? start
              }
            />
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
              width={48}
            />
            <Tooltip
              labelFormatter={(start) =>
                labelByStart.get(String(start)) ?? String(start)
              }
            />
            {!isRating && <Legend />}
            {isRating ? (
              <Line
                type="linear"
                dataKey="average"
                name={metric.label}
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                connectNulls={false}
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
