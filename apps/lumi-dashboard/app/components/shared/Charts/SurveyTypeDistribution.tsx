import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { useTheme } from "~/context/ThemeContext";
import { useSurveyTypeDistribution } from "~/hooks/useSurveyTypeDistribution";
import type { SurveyType } from "~/types/api";

/**
 * Survey type configuration with Norwegian labels and colors
 */
const SURVEY_TYPE_CONFIG: Record<SurveyType, { label: string; color: string }> =
  {
    rating: { label: "Vurdering", color: "#22c55e" },
    topTasks: { label: "Top Tasks", color: "#3b82f6" },
    discovery: { label: "Discovery", color: "#f59e0b" },
    taskPriority: { label: "Task Priority", color: "#8b5cf6" },
    custom: { label: "Custom", color: "#6b7280" },
  };

// Chart colors
const CHART_COLORS = {
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  tooltip: {
    bg: "#1c1f24",
    border: "rgba(255, 255, 255, 0.15)",
    text: "#ffffff",
  },
};

const CHART_COLORS_LIGHT = {
  text: "#262626",
  textMuted: "#545454",
  tooltip: {
    bg: "#ffffff",
    border: "#a0a0a0",
    text: "#262626",
  },
};

interface SurveyTypeDistributionProps {
  /** Height of the chart in pixels */
  height?: number | string;
}

export function SurveyTypeDistribution({
  height = "100%",
}: SurveyTypeDistributionProps) {
  const { data: distribution, isPending } = useSurveyTypeDistribution();
  const { theme } = useTheme();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending) {
    return <ChartLoadingState />;
  }

  if (!distribution || distribution.distribution.length === 0) {
    return (
      <ChartEmptyState
        message="Ingen survey-data tilgjengelig"
        color={colors.textMuted}
      />
    );
  }

  // Transform API data to chart format
  const data = distribution.distribution.map((item) => {
    const surveyType = item.type as SurveyType;
    const config = SURVEY_TYPE_CONFIG[surveyType] || {
      label: item.type,
      color: "#6b7280",
    };
    return {
      type: surveyType,
      label: config.label,
      count: item.count,
      percentage: item.percentage,
      color: config.color,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          width={75}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const d = payload[0].payload;
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
                    {d.label}
                  </div>
                  <div>
                    {d.count} {d.count === 1 ? "survey" : "surveys"} (
                    {d.percentage}%)
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
          {data.map((entry) => (
            <Cell key={entry.type} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
