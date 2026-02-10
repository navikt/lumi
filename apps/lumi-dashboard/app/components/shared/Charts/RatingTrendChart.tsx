import { Skeleton } from "@navikt/ds-react";
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
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import styles from "./Charts.module.css";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#FBBF24", // Gul/gull for rating
  primaryFaded: "rgba(251, 191, 36, 0.3)",
  reference: "rgba(255, 255, 255, 0.2)",
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
};

const CHART_COLORS_LIGHT = {
  primary: "#D97706", // Amber 600 - darker gold for light mode
  primaryFaded: "rgba(217, 119, 6, 0.2)",
  reference: "rgba(0, 0, 0, 0.2)",
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
};

export function RatingTrendChart() {
  const { data: stats, isPending } = useStats();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { theme } = useTheme();
  const { isMobile } = useBreakpoint();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  // Responsive chart margins - minimal margins to maximize chart area
  const chartMargin = isMobile
    ? { top: 15, right: 5, left: 0, bottom: 20 }
    : { top: 15, right: 10, left: 5, bottom: 20 };

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  const ratingByDate = stats?.ratingByDate || {};

  // Transform and sort by date
  const data = Object.entries(ratingByDate)
    .map(([date, { average, count }]) => ({
      date,
      average,
      count,
      displayDate: dayjs(date).format("DD.MM"),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  // Calculate overall average for reference line
  const overallAverage = stats?.averageRating || 0;

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
        aria-label={`Linjediagram som viser gjennomsnittlig vurdering over tid. Totalt snitt: ${overallAverage.toFixed(1)}`}
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
                ? data.find(
                    (d) =>
                      d.displayDate === state.activeLabel ||
                      d.date === state.activeLabel,
                  )
                : undefined;
          if (!clickData) return;

          const { date, average } = clickData;
          if (!date || typeof date !== "string") return;
          if (typeof average !== "number") return;

          navigate({
            to: "/feedback",
            search: {
              ...params,
              fromDate: date,
              toDate: date,
              lowRating: average < 3 ? "true" : undefined,
            },
          });
        }}
        className={styles.chartClickable}
      >
        <XAxis
          dataKey="displayDate"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width={20}
          hide={isMobile}
        />
        <ReferenceLine
          y={overallAverage}
          stroke={colors.reference}
          strokeDasharray="3 3"
        />
        <Tooltip
          cursor={{ stroke: colors.reference, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (active && payload && payload.length && payload[0]) {
              const point = payload[0].payload as {
                date: string;
                average: number;
                count: number;
              };
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipTitle}>
                    {dayjs(point.date).format("DD. MMMM YYYY")}
                  </div>
                  <div className={styles.tooltipRow}>
                    <span className={styles.tooltipEmojiLarge}>
                      {ratingToEmoji(Math.round(point.average))}
                    </span>
                    <span className={styles.tooltipStrong}>
                      {point.average.toFixed(1)}
                    </span>
                    <span className={styles.tooltipMuted}>
                      ({point.count} {point.count === 1 ? "svar" : "svar"})
                    </span>
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
        <Line
          type="monotone"
          dataKey="average"
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
