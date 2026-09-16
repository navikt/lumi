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
}

export function QuestionTrendChart({
  trend,
  buckets,
  measure,
}: QuestionTrendChartProps) {
  const isRating = trend.fieldType === "RATING";
  const metric = questionTrendRatingMetric(trend);
  const chartData = questionTrendChartData(trend, buckets, measure);
  const ariaLabel = isRating
    ? `Linjediagram for ${trend.label}, med ${metric.label.toLowerCase()} per periode. Tabellen under viser de samme tallene.`
    : `Linjediagram for ${trend.label}, med ${measure === "count" ? "antall" : "andel"} respondenter per svaralternativ. Tabellen under viser de samme tallene.`;

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
            <XAxis dataKey="label" tickLine={false} minTickGap={24} />
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
            <Tooltip />
            {!isRating && <Legend />}
            {isRating ? (
              <Line
                type="monotone"
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
                  type="monotone"
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
