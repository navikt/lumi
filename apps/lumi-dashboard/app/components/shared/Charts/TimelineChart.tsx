import { Skeleton } from "@navikt/ds-react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function TimelineChart() {
  const { data: stats, isPending } = useStats();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const { isMobile } = useBreakpoint();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  // Responsive chart margins - minimal margins to maximize chart area
  const chartMargin = isMobile
    ? { top: 15, right: 5, left: 0, bottom: 20 }
    : { top: 15, right: 10, left: 5, bottom: 20 };

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  const byDate = stats?.byDate || {};

  // Transform and sort by date
  const data = Object.entries(byDate)
    .map(([date, count]) => ({
      date,
      count,
      displayDate: dayjs(date).format("DD.MM"),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <div className={styles.chartNoData}>Ingen data for valgt periode</div>
    );
  }

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <BarChart
        data={data}
        margin={chartMargin}
        role="img"
        aria-label={`Stolpediagram som viser ${data.length} dager med tilbakemeldinger`}
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
          const date = clickData?.date;
          if (!date) return;

          navigate({
            to: "/feedback",
            search: {
              ...params,
              fromDate: date,
              toDate: date,
            },
          });
        }}
        className={styles.chartClickable}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="displayDate"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width={25}
          hide={isMobile}
        />
        <Tooltip
          cursor={{ fill: colors.primaryFaded }}
          content={({ active, payload }) => {
            if (active && payload && payload.length && payload[0]) {
              const point = payload[0].payload as {
                date: string;
                count: number;
              };
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipTitle}>
                    {dayjs(point.date).format("DD. MMMM YYYY")}
                  </div>
                  <div>
                    {point.count.toLocaleString("no-NO")} tilbakemeldinger
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
        <Bar
          dataKey="count"
          fill={colors.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
