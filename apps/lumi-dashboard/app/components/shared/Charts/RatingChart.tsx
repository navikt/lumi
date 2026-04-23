import { BodyShort, Skeleton } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import { Bar, BarChart, Rectangle, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveContainerWithInitialSize } from "~/components/shared/Charts/ResponsiveContainerWithInitialSize";
import { useBreakpoint } from "~/hooks/useBreakpoint";
import { useStats } from "~/hooks/useStats";
import type { RatingStats } from "~/types/api";
import {
  inferRatingVariantFromDistribution,
  type RatingVariant,
} from "~/utils/ratingDisplay";
import styles from "./Charts.module.css";

// ============================================
// Display Configurations for Different Scales
// ============================================

// Emoji (5-point): 😡 🙁 😐 😀 😍
const EMOJI_CONFIG = {
  labels: ["😡", "🙁", "😐", "😀", "😍"],
  colors: ["#EF4444", "#F97316", "#FBBF24", "#4ADE80", "#22C55E"],
  scale: [1, 2, 3, 4, 5],
};

// Thumbs (2-point): 👎 👍
const THUMBS_CONFIG = {
  labels: ["👎", "👍"],
  colors: ["#EF4444", "#22C55E"],
  scale: [1, 2],
};

// Stars (5-point fixed): Star labels with gradient colors
const STARS_CONFIG = {
  labels: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
  colors: ["#EF4444", "#F97316", "#FBBF24", "#84CC16", "#22C55E"],
  scale: [1, 2, 3, 4, 5],
};

// NPS (0-10): Number labels with color zones
const NPS_CONFIG = {
  labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  // Detractors (0-6): red, Passives (7-8): yellow, Promoters (9-10): green
  colors: [
    "#EF4444",
    "#EF4444",
    "#EF4444",
    "#EF4444",
    "#EF4444",
    "#EF4444",
    "#EF4444",
    "#FBBF24",
    "#FBBF24",
    "#22C55E",
    "#22C55E",
  ],
  scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

function getConfigForVariant(variant: RatingVariant) {
  switch (variant) {
    case "thumbs":
      return THUMBS_CONFIG;
    case "nps":
      return NPS_CONFIG;
    case "stars":
      return STARS_CONFIG;
    default:
      return EMOJI_CONFIG;
  }
}

type RatingBarShapeProps = ComponentProps<typeof Rectangle> & {
  payload?: { color?: string };
};

function RatingBarShape(props: RatingBarShapeProps) {
  const { payload, ...rectangleProps } = props;
  return (
    <Rectangle
      {...rectangleProps}
      fill={payload?.color ?? "#6b7280"}
      radius={[4, 4, 0, 0]}
    />
  );
}

export function RatingChart() {
  const { data: stats, isPending } = useStats();
  const { isMobile } = useBreakpoint();

  if (isPending) {
    return <Skeleton variant="rectangle" height={300} />;
  }

  // Get rating field info from fieldStats
  const ratingField = stats?.fieldStats?.find((f) => f.fieldType === "RATING");
  const ratingStats = ratingField?.stats as RatingStats | undefined;

  // Prefer concrete rating-field distribution to avoid mixing scales.
  // Fallback to legacy/global byRating when fieldStats is missing.
  const fieldDistribution = ratingStats?.distribution || {};
  const fieldDistributionEntries = Object.entries(fieldDistribution).filter(
    ([, count]) => typeof count === "number" && count > 0,
  );
  const byRating = stats?.byRating || {};
  const byRatingEntries = Object.entries(byRating).filter(
    ([, count]) => typeof count === "number" && count > 0,
  );
  const distributionEntries =
    fieldDistributionEntries.length > 0
      ? fieldDistributionEntries
      : byRatingEntries;

  if (distributionEntries.length === 0) {
    return (
      <div className={styles.chartNoData}>
        <BodyShort>Ingen vurderinger i valgt periode</BodyShort>
      </div>
    );
  }

  const scopedDistribution: Record<string, number> =
    Object.fromEntries(distributionEntries);

  const explicitVariant = (
    ratingStats as RatingStats & { ratingVariant?: unknown }
  )?.ratingVariant;
  const ratingVariant = inferRatingVariantFromDistribution(
    scopedDistribution,
    explicitVariant,
  );
  const ratingConfig = getConfigForVariant(ratingVariant);
  const chartMargin = isMobile
    ? { top: 10, right: 5, left: 5, bottom: 30 }
    : { top: 16, right: 8, left: 8, bottom: ratingVariant === "nps" ? 32 : 36 };

  // Build data array based on detected type
  let data: { label: string; value: number; count: number; color: string }[];

  switch (ratingVariant) {
    case "thumbs":
      data = ratingConfig.scale.map((rating, i) => ({
        label: ratingConfig.labels[i],
        value: rating,
        count: scopedDistribution[String(rating)] || 0,
        color: ratingConfig.colors[i],
      }));
      break;
    case "nps":
      data = ratingConfig.scale.map((rating, i) => ({
        label: ratingConfig.labels[i],
        value: rating,
        count: scopedDistribution[String(rating)] || 0,
        color: ratingConfig.colors[i],
      }));
      break;
    case "stars": {
      data = ratingConfig.scale.map((rating, i) => ({
        label: ratingConfig.labels[i],
        value: rating,
        count: scopedDistribution[String(rating)] || 0,
        color: ratingConfig.colors[i],
      }));
      break;
    }
    default:
      data = ratingConfig.scale.map((rating, i) => ({
        label: ratingConfig.labels[i],
        value: rating,
        count: scopedDistribution[String(rating)] || 0,
        color: ratingConfig.colors[i],
      }));
      break;
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className={styles.chartNoData}>
        <BodyShort>Ingen vurderinger i valgt periode</BodyShort>
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
        margin={chartMargin}
        role="img"
        aria-label={`Søylediagram som viser fordeling av vurderinger: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}
      >
        <XAxis
          dataKey="label"
          tick={{
            fontSize: ratingVariant === "nps" ? 12 : isMobile ? 20 : 24,
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload?.length && payload[0]) {
              const item = payload[0].payload as {
                label: string;
                count: number;
              };
              const percentage =
                total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
              return (
                <div className={styles.tooltipCard}>
                  <div
                    className={[
                      styles.tooltipEmojiLarge,
                      styles.tooltipTitle,
                    ].join(" ")}
                  >
                    {item.label}
                  </div>
                  <div className={styles.tooltipStrong}>
                    {item.count.toLocaleString("no-NO")} svar
                  </div>
                  <div className={styles.tooltipMuted}>{percentage}%</div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" shape={<RatingBarShape />} />
      </BarChart>
    </ResponsiveContainerWithInitialSize>
  );
}
