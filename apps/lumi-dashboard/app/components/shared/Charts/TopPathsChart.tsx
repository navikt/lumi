import { Skeleton } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import { Bar, BarChart, Rectangle, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useTheme } from "~/context/ThemeContext";
import { useStats } from "~/hooks/useStats";
import styles from "./Charts.module.css";

const CHART_COLORS = {
  bar: "#818CF8", // Purple
  barHover: "#A5B4FC",
  text: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
};

const CHART_COLORS_LIGHT = {
  bar: "#6366f1", // Indigo 500
  barHover: "#818cf8", // Indigo 400
  text: "#262626", // Nav Gray 90
  textMuted: "#545454", // Nav Gray 60
};

// Color based on rating
function getRatingColor(rating: number): string {
  if (rating >= 4) return "#34D399"; // Green
  if (rating >= 3) return "#FBBF24"; // Yellow
  return "#F87171"; // Red
}

function getRatingClass(rating: number): string {
  if (rating >= 4) return styles.tooltipRatingGood;
  if (rating >= 3) return styles.tooltipRatingMedium;
  return styles.tooltipRatingLow;
}

type TopPathsBarShapeProps = ComponentProps<typeof Rectangle> & {
  payload?: { averageRating?: number };
};

function TopPathsBarShape(props: TopPathsBarShapeProps) {
  const { payload, ...rectangleProps } = props;
  return (
    <Rectangle
      {...rectangleProps}
      fill={getRatingColor(payload?.averageRating ?? 0)}
      radius={[0, 4, 4, 0]}
    />
  );
}

export function TopPathsChart() {
  const { data: stats, isPending } = useStats();
  const { theme } = useTheme();

  const colors = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;

  if (isPending) {
    return <Skeleton variant="rectangle" height={250} />;
  }

  const byPathname = stats?.byPathname || {};

  // Transform to array, filter out unknown, and sort by count
  const data = Object.entries(byPathname)
    .filter(([pathname]) => pathname !== "unknown")
    .map(([pathname, { count, averageRating }]) => ({
      pathname,
      shortPath: shortenPath(pathname),
      count,
      averageRating,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (data.length === 0) {
    return (
      <div
        className={[styles.emptyStateCentered, styles.emptyStateMuted].join(
          " ",
        )}
      >
        Ingen stier tilgjengelig
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
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="shortPath"
          axisLine={false}
          tickLine={false}
          tick={{ fill: colors.text, fontSize: 11 }}
          width={115}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length && payload[0]) {
              const point = payload[0].payload as {
                pathname: string;
                count: number;
                averageRating: number;
              };
              return (
                <div className={styles.tooltipCard}>
                  <div className={styles.tooltipPathTitle}>
                    {point.pathname}
                  </div>
                  <div>{point.count} tilbakemeldinger</div>
                  <div className={getRatingClass(point.averageRating)}>
                    Snittrating: {point.averageRating.toFixed(1)}{" "}
                    {ratingToEmoji(Math.round(point.averageRating))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" shape={<TopPathsBarShape />} />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}

function shortenPath(pathname: string): string {
  // Remove leading slash
  const path = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  // Split and take last meaningful parts
  const parts = path.split("/").filter(Boolean);

  if (parts.length <= 2) {
    return `/${parts.join("/")}`;
  }

  // Show first part and last part with ellipsis
  return `/${parts[0]}/.../${parts[parts.length - 1]}`;
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
