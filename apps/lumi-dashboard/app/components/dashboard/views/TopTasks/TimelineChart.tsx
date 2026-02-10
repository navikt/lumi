import { Skeleton } from "@navikt/ds-react";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import styles from "./TopTasks.module.css";

// Chart colors for dark mode (reused from others for consistency)
const CHART_COLORS = {
  // success: "#66CBEC", // Original Teal
  // success: "#4ade80",
  // Actually, user might want distinction. Let's use a nice visible green.
  success: "#2ced7b", // Bright green
  primaryFaded: "rgba(44, 237, 123, 0.2)",
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  tooltip: {
    bg: "#1c1f24",
    border: "rgba(255, 255, 255, 0.15)",
    text: "#ffffff",
  },
};

const CHART_COLORS_LIGHT = {
  success: "#16a34a", // Green 600 - darker for light mode
  primaryFaded: "rgba(22, 163, 74, 0.1)",
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
  tooltip: {
    bg: "#ffffff",
    border: "#a0a0a0", // Nav Gray 40
    text: "#262626",
  },
};

export function TopTasksTimelineChart() {
  const { data: stats, isPending } = useTopTasksStats();
  const { theme } = useTheme();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  const dailyStats = stats?.dailyStats || {};

  // Transform and sort by date
  const data = Object.entries(dailyStats)
    .map(([date, stat]) => {
      const rate = stat.total > 0 ? (stat.success / stat.total) * 100 : 0;
      return {
        date,
        successRate: Math.round(rate),
        total: stat.total,
        success: stat.success,
        displayDate: dayjs(date).format("DD.MM"),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <div
        className={`${styles.timelineEmpty} ${theme === "light" ? styles.timelineEmptyLight : styles.timelineEmptyDark}`}
      >
        Ingen data for valgt periode
      </div>
    );
  }

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <AreaChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <defs>
          <linearGradient id="colorSuccessRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.success} stopOpacity={0.4} />
            <stop offset="95%" stopColor={colors.success} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="displayDate"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          orientation="left"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          unit="%"
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const d = payload[0].payload;
              return (
                <div
                  className={`${styles.tooltip} ${theme === "light" ? styles.tooltipLight : styles.tooltipDark}`}
                >
                  <div className={styles.tooltipTitle}>
                    {dayjs(d.date).format("DD. MMMM YYYY")}
                  </div>
                  <div
                    className={
                      theme === "light"
                        ? styles.tooltipSuccessLight
                        : styles.tooltipSuccessDark
                    }
                  >
                    Suksessrate: {d.successRate}%
                  </div>
                  <div className={styles.tooltipMeta}>
                    {d.success} av {d.total} oppgaver fullført
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="successRate"
          stroke={colors.success}
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSuccessRate)"
        />
      </AreaChart>
    </ResponsiveContainerWithInitialSize>
  );
}
