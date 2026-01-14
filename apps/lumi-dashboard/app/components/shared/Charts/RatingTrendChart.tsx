import { Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "~/context/ThemeContext";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#FBBF24", // Gul/gull for rating
  primaryFaded: "rgba(251, 191, 36, 0.3)",
  reference: "rgba(255, 255, 255, 0.2)",
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  tooltip: {
    bg: "#1c1f24",
    border: "rgba(255, 255, 255, 0.15)",
    text: "#ffffff",
  },
};

const CHART_COLORS_LIGHT = {
  primary: "#D97706", // Amber 600 - darker gold for light mode
  primaryFaded: "rgba(217, 119, 6, 0.2)",
  reference: "rgba(0, 0, 0, 0.2)",
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
  tooltip: {
    bg: "#ffffff",
    border: "#a0a0a0", // Nav Gray 40
    text: "#262626",
  },
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
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.textMuted,
        }}
      >
        Ingen data for valgt periode
      </div>
    );
  }

  // Calculate overall average for reference line
  const overallAverage = stats?.averageRating || 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={chartMargin}
        role="img"
        aria-label={`Linjediagram som viser gjennomsnittlig vurdering over tid. Totalt snitt: ${overallAverage.toFixed(1)}`}
        onClick={(e) => {
          if (e?.activePayload && e.activePayload.length > 0) {
            const clickData = e.activePayload[0].payload;
            const date = clickData.date;
            const average = clickData.average;

            navigate({
              to: "/feedback",
              search: {
                ...params,
                fromDate: date,
                toDate: date,
                lowRating: average < 3 ? "true" : undefined,
              },
            });
          }
        }}
        style={{ cursor: "pointer" }}
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
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div
                  style={{
                    background: colors.tooltip.bg,
                    color: colors.tooltip.text,
                    padding: "0.75rem",
                    borderRadius: "4px",
                    border: `1px solid ${colors.tooltip.border}`,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {dayjs(data.date).format("DD. MMMM YYYY")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>
                      {ratingToEmoji(Math.round(data.average))}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {data.average.toFixed(1)}
                    </span>
                    <span style={{ color: colors.textMuted }}>
                      ({data.count} {data.count === 1 ? "svar" : "svar"})
                    </span>
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
    </ResponsiveContainer>
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
