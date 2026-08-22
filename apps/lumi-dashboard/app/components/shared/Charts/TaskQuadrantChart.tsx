import { Skeleton } from "@navikt/ds-react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import styles from "./Charts.module.css";

const CHART_COLORS = {
  danger: "#ef4444", // Red for crisis zone
  warning: "#f59e0b", // Amber for watch zone
  success: "#22c55e", // Green for good zone
  muted: "#6b7280", // Gray for low priority
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  zones: {
    crisis: "rgba(239, 68, 68, 0.15)",
    watch: "rgba(245, 158, 11, 0.1)",
    good: "rgba(34, 197, 94, 0.1)",
    lowPriority: "rgba(107, 114, 128, 0.05)",
  },
  selected: "#ffffff",
};

const CHART_COLORS_LIGHT = {
  danger: "#dc2626",
  warning: "#d97706",
  success: "#16a34a",
  muted: "#9ca3af",
  text: "#262626",
  textMuted: "#545454",
  zones: {
    crisis: "rgba(220, 38, 38, 0.08)",
    watch: "rgba(217, 119, 6, 0.06)",
    good: "rgba(22, 163, 74, 0.06)",
    lowPriority: "rgba(156, 163, 175, 0.04)",
  },
  selected: "#262626",
};

// Thresholds for quadrant classification
const VOLUME_THRESHOLD = 50; // Tasks with >= 50 responses are "high volume"
const SUCCESS_THRESHOLD = 70; // Tasks with < 70% success need attention

interface TaskDataPoint {
  id: string;
  name: string;
  volume: number;
  successRate: number;
  zone: "crisis" | "watch" | "good" | "lowPriority";
}

interface TaskPointShapeProps {
  cx?: number;
  cy?: number;
  size?: number;
  payload?: TaskDataPoint;
}

function getZone(volume: number, successRate: number): TaskDataPoint["zone"] {
  const isHighVolume = volume >= VOLUME_THRESHOLD;
  const isLowSuccess = successRate < SUCCESS_THRESHOLD;

  if (isHighVolume && isLowSuccess) return "crisis";
  if (isHighVolume && !isLowSuccess) return "good";
  if (!isHighVolume && isLowSuccess) return "watch";
  return "lowPriority";
}

function getZoneColor(
  zone: TaskDataPoint["zone"],
  colors: typeof CHART_COLORS,
): string {
  switch (zone) {
    case "crisis":
      return colors.danger;
    case "watch":
      return colors.warning;
    case "good":
      return colors.success;
    case "lowPriority":
      return colors.muted;
  }
}

function getZoneTextClass(zone: TaskDataPoint["zone"]): string {
  switch (zone) {
    case "crisis":
      return styles.tooltipRatingLow;
    case "watch":
      return styles.tooltipRatingMedium;
    case "good":
      return styles.tooltipRatingGood;
    case "lowPriority":
      return styles.tooltipMuted;
  }
}

interface TaskQuadrantChartProps {
  /** Callback when a task point is clicked */
  onTaskSelect?: (taskId: string | null) => void;
  /** Currently selected stable task id */
  selectedTask?: string | null;
}

export function TaskQuadrantChart({
  onTaskSelect,
  selectedTask,
}: TaskQuadrantChartProps) {
  const { data: stats, isPending } = useTopTasksStats();
  const { theme } = useTheme();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending) {
    return <Skeleton variant="rectangle" height={350} />;
  }

  if (!stats?.tasks || stats.tasks.length === 0) {
    return (
      <div className={styles.chartNoData}>Ingen oppgavedata tilgjengelig</div>
    );
  }

  // Transform tasks to scatter data
  const data: TaskDataPoint[] = stats.tasks.map((task) => ({
    id: task.taskId,
    name: task.task,
    volume: task.totalCount,
    successRate: Math.round(task.successRate * 100),
    zone: getZone(task.totalCount, Math.round(task.successRate * 100)),
  }));

  // Find max volume for X axis domain
  const maxVolume = Math.max(
    ...data.map((d) => d.volume),
    VOLUME_THRESHOLD * 2,
  );

  const handleClick = (data: TaskDataPoint) => {
    if (onTaskSelect) {
      // Toggle selection: if clicking the same task, deselect
      onTaskSelect(data.id === selectedTask ? null : data.id);
    }
  };

  const renderTaskPoint = ({ cx, cy, size, payload }: TaskPointShapeProps) => {
    if (typeof cx !== "number" || typeof cy !== "number" || !payload) {
      return null;
    }

    const isSelected = payload.id === selectedTask;
    const fill = getZoneColor(payload.zone, colors);
    const pointSize = typeof size === "number" ? size : 100;
    const radius = Math.max(4, Math.sqrt(pointSize / Math.PI));

    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={isSelected ? colors.selected : fill}
        strokeWidth={isSelected ? 3 : 2}
        className={isSelected ? styles.selectedScatterCell : undefined}
      />
    );
  };

  return (
    <ResponsiveContainerWithInitialSize
      width="100%"
      height="100%"
      minWidth={2}
      minHeight={2}
    >
      <ScatterChart
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        role="img"
        aria-label={`Punktdiagram som viser volum og suksessrate for ${data.length} oppgaver. Samme data vises i tabellen.`}
      >
        {/* Quadrant background zones */}
        {/* Bottom-right: CRISIS (high volume, low success) */}
        <ReferenceArea
          x1={VOLUME_THRESHOLD}
          x2={maxVolume}
          y1={0}
          y2={SUCCESS_THRESHOLD}
          fill={colors.zones.crisis}
          fillOpacity={1}
        />
        {/* Top-right: GOOD (high volume, high success) */}
        <ReferenceArea
          x1={VOLUME_THRESHOLD}
          x2={maxVolume}
          y1={SUCCESS_THRESHOLD}
          y2={100}
          fill={colors.zones.good}
          fillOpacity={1}
        />
        {/* Bottom-left: WATCH (low volume, low success) */}
        <ReferenceArea
          x1={0}
          x2={VOLUME_THRESHOLD}
          y1={0}
          y2={SUCCESS_THRESHOLD}
          fill={colors.zones.watch}
          fillOpacity={1}
        />
        {/* Top-left: LOW PRIORITY (low volume, high success) */}
        <ReferenceArea
          x1={0}
          x2={VOLUME_THRESHOLD}
          y1={SUCCESS_THRESHOLD}
          y2={100}
          fill={colors.zones.lowPriority}
          fillOpacity={1}
        />

        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />

        <XAxis
          type="number"
          dataKey="volume"
          name="Volum"
          domain={[0, maxVolume]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          label={{
            value: "Volum (antall svar)",
            position: "bottom",
            offset: 0,
            fill: colors.textMuted,
            fontSize: 12,
          }}
        />

        <YAxis
          type="number"
          dataKey="successRate"
          name="Suksessrate"
          domain={[0, 100]}
          unit="%"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 12 }}
          label={{
            value: "Suksessrate",
            angle: -90,
            position: "insideLeft",
            fill: colors.textMuted,
            fontSize: 12,
          }}
        />

        <ZAxis range={[100, 400]} />

        {/* Reference lines for thresholds */}
        <ReferenceLine
          x={VOLUME_THRESHOLD}
          stroke={colors.textMuted}
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          y={SUCCESS_THRESHOLD}
          stroke={colors.textMuted}
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />

        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (active && payload?.length && payload[0]) {
              const d = payload[0].payload as TaskDataPoint;
              const zoneLabels = {
                crisis: "🔴 KRISE - Mange prøver, få lykkes",
                watch: "🟡 OVERVÅK - Lav suksess, men lavt volum",
                good: "🟢 BRA - Høyt volum, høy suksess",
                lowPriority: "⚪ LAV PRIORITET - Lite trafikk",
              };
              return (
                <div
                  className={[
                    styles.tooltipCard,
                    styles.tooltipCardMaxWidth,
                  ].join(" ")}
                >
                  <div className={styles.tooltipPathTitle}>{d.name}</div>
                  <div className={styles.tooltipTitle}>
                    <strong>Volum:</strong> {d.volume} svar
                  </div>
                  <div className={styles.tooltipTitle}>
                    <strong>Suksessrate:</strong> {d.successRate}%
                  </div>
                  <div
                    className={[
                      styles.tooltipTaskZone,
                      getZoneTextClass(d.zone),
                    ].join(" ")}
                  >
                    {zoneLabels[d.zone]}
                  </div>
                  {onTaskSelect && (
                    <div className={styles.tooltipHint}>
                      Klikk for å filtrere tabellen
                    </div>
                  )}
                </div>
              );
            }
            return null;
          }}
        />

        <Scatter
          name="Oppgaver"
          data={data}
          cursor={onTaskSelect ? "pointer" : "default"}
          onClick={(data) => handleClick(data as unknown as TaskDataPoint)}
          shape={renderTaskPoint}
        />
      </ScatterChart>
    </ResponsiveContainerWithInitialSize>
  );
}
