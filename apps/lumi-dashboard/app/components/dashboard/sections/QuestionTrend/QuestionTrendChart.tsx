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
import { formatQuestionTrendBucket } from "./questionTrendUtils";

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
  const chartData = buckets.map((bucket) => ({
    label: formatQuestionTrendBucket(bucket.startDate, trend.interval),
    ...(isRating
      ? { average: bucket.masked ? null : (bucket.average ?? null) }
      : Object.fromEntries(
          trend.options.map((option) => [
            option.id,
            bucket.masked
              ? null
              : (bucket.distribution[option.id]?.[measure] ?? 0),
          ]),
        )),
  }));
  const ariaLabel = isRating
    ? `Linjediagram for ${trend.label}, med gjennomsnittlig vurdering per ${trend.interval}. Tabellen under viser de samme tallene.`
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
              domain={isRating ? ["auto", "auto"] : [0, "auto"]}
              tickLine={false}
              unit={!isRating && measure === "percentage" ? "%" : undefined}
              width={48}
            />
            <Tooltip />
            {!isRating && <Legend />}
            {isRating ? (
              <Line
                type="monotone"
                dataKey="average"
                name="Gjennomsnitt"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                connectNulls={false}
              />
            ) : (
              trend.options.map((option, index) => (
                <Line
                  key={option.id}
                  type="monotone"
                  dataKey={option.id}
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
