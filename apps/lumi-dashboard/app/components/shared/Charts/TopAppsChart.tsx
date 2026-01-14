import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { useTheme } from "~/context/ThemeContext";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";

// Chart colors for dark mode
const CHART_COLORS = {
  primary: "#60A5FA", // Blue for bars
  text: "rgba(255, 255, 255, 0.85)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  tooltip: {
    bg: "#1c1f24",
    border: "rgba(255, 255, 255, 0.15)",
    text: "#ffffff",
  },
};

const CHART_COLORS_LIGHT = {
  primary: "#0067c5", // Nav Blue
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
  tooltip: {
    bg: "#ffffff",
    border: "#a0a0a0", // Nav Gray 40
    text: "#262626",
  },
};

export function TopAppsChart() {
  const { data: stats, isPending } = useStats();
  const { theme } = useTheme();
  const { setParam } = useSearchParams();

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
    return (
      <ChartEmptyState
        message="Ingen app-data tilgjengelig"
        color={colors.textMuted}
      />
    );
  }

  const handleBarClick = (data: { app: string }) => {
    setParam("app", data.app);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
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
                    {data.app}
                  </div>
                  <div>
                    {data.count.toLocaleString("no-NO")} tilbakemeldinger
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                      opacity: 0.7,
                    }}
                  >
                    Klikk for å filtrere
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar
          dataKey="count"
          fill={CHART_COLORS.primary}
          radius={[0, 4, 4, 0]}
          cursor="pointer"
          onClick={handleBarClick}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
