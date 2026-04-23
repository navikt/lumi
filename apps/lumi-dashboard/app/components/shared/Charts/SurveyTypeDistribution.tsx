import type { ComponentProps } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "~/components/shared/Charts/ChartEmptyState";
import { ChartLoadingState } from "~/components/shared/Charts/ChartLoadingState";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useSurveyTypeDistribution } from "~/hooks/useSurveyTypeDistribution";
import type { SurveyType } from "~/types/api";
import styles from "./Charts.module.css";

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
};

const CHART_COLORS_LIGHT = {
  text: "#262626",
  textMuted: "#545454",
};

interface SurveyTypeDistributionProps {
  /** Height of the chart in pixels */
  height?: number | `${number}%`;
}

type SurveyTypeBarShapeProps = ComponentProps<typeof Rectangle> & {
  payload?: { color?: string };
};

function SurveyTypeBarShape(props: SurveyTypeBarShapeProps) {
  const { payload, ...rectangleProps } = props;
  return (
    <Rectangle
      {...rectangleProps}
      fill={payload?.color ?? "#6b7280"}
      radius={[0, 4, 4, 0]}
    />
  );
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
    return <ChartEmptyState message="Ingen survey-data tilgjengelig" />;
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
    <ResponsiveContainerWithInitialSize width="100%" height={height}>
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
            if (active && payload?.length && payload[0]) {
              const point = payload[0].payload as {
                label: string;
                count: number;
                percentage: number;
              };
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipTitle}>{point.label}</div>
                  <div>
                    {point.count} {point.count === 1 ? "survey" : "surveys"} (
                    {point.percentage}%)
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" maxBarSize={30} shape={<SurveyTypeBarShape />} />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
