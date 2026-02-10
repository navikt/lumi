import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import styles from "./Charts.module.css";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#60A5FA", // Blue for bars
  text: "rgba(255, 255, 255, 0.85)",
  textMuted: "rgba(255, 255, 255, 0.5)",
};

const CHART_COLORS_LIGHT = {
  primary: "#0067c5", // Nav Blue
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
};

export function TopAppsChart() {
  const { data: stats, isPending } = useStats();
  const { theme } = useTheme();
  const { setParams } = useSearchParams();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending) {
    return <ChartLoadingState />;
  }

  const byApp = stats?.byApp || {};

  // Transform and sort by count, take top 10
  const data = Object.entries(byApp)
    .map(([app, count]) => ({ app, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (data.length === 0) {
    return <ChartEmptyState message="Ingen app-data tilgjengelig" />;
  }

  const handleBarClick = (
    bar: { payload?: { app?: unknown } },
    _index: number,
  ) => {
    const app = bar.payload?.app;
    if (typeof app !== "string") return;
    setParams({
      app,
      page: "1",
    });
  };

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
        role="img"
        aria-label={`Horisontalt søylediagram som viser antall tilbakemeldinger per app. ${data.length} apper vist.`}
      >
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.textMuted, fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="app"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          width={90}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length && payload[0]) {
              const point = payload[0].payload as {
                app: string;
                count: number;
              };
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipTitle}>{point.app}</div>
                  <div>
                    {point.count.toLocaleString("no-NO")} tilbakemeldinger
                  </div>
                  <div className={styles.tooltipHint}>Klikk for å filtrere</div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar
          dataKey="count"
          fill={colors.primary}
          radius={[0, 4, 4, 0]}
          cursor="pointer"
          onClick={handleBarClick}
        />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
