import { Heading, Skeleton, VStack } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { useContextTags } from "~/hooks/useContextTags";
import type { MetadataValueWithCount } from "~/types/api";
import { formatMetadataLabel } from "~/utils/segmentUtils";
import styles from "./SegmentBreakdown.module.css";

interface SegmentBreakdownProps {
  surveyId: string;
  /** Called when user clicks a segment value for filtering */
  onSegmentClick?: (key: string, value: string) => void;
}

// Beautiful color palette for bars
const COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // yellow
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

/**
 * Auto-segmentation component that displays context.tags as bar charts.
 * Uses real counts from API.
 */
export function SegmentBreakdown({
  surveyId,
  onSegmentClick,
}: SegmentBreakdownProps) {
  const { data, isLoading, error } = useContextTags(surveyId);

  if (isLoading) {
    return <SegmentBreakdownSkeleton />;
  }

  if (error) {
    console.error("SegmentBreakdown error:", error);
    return null;
  }

  const contextTags = data?.contextTags ?? {};
  const entries = Object.entries(contextTags);

  if (entries.length === 0) {
    return null;
  }

  return (
    <VStack gap="space-16" marginBlock="space-24 space-16">
      <Heading level="3" size="small">
        Segmentering
      </Heading>

      <DashboardGrid
        minColumnWidth="280px"
        gap={{ xs: "space-16", md: "space-24" }}
      >
        {entries.map(([key, values]) => (
          <SegmentCard
            key={key}
            segmentKey={key}
            values={values}
            onValueClick={onSegmentClick}
          />
        ))}
      </DashboardGrid>
    </VStack>
  );
}

interface SegmentCardProps {
  segmentKey: string;
  values: MetadataValueWithCount[];
  onValueClick?: (key: string, value: string) => void;
}

function SegmentCard({ segmentKey, values, onValueClick }: SegmentCardProps) {
  // Calculate percentages from real counts
  const total = values.reduce((sum, d) => sum + d.count, 0);
  const chartData = values.map((item) => ({
    name: item.value,
    count: item.count,
    percentage: Math.round((item.count / total) * 100),
  }));

  const label = formatMetadataLabel(segmentKey);
  const maxCount = Math.max(...chartData.map((d) => d.count));

  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
      <VStack gap="space-12">
        <Heading level="4" size="xsmall">
          {label}
        </Heading>
        <VStack gap="space-4">
          {chartData.map((item, index) => (
            <button
              type="button"
              key={item.name}
              className={styles.segmentRow}
              onClick={() => onValueClick?.(segmentKey, item.name)}
            >
              <span className={styles.segmentLabel}>{item.name}</span>
              <div className={styles.barBackground}>
                <div
                  className={styles.bar}
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    background: COLORS[index % COLORS.length],
                  }}
                />
              </div>
              <span className={styles.segmentCount}>
                {item.count} ({item.percentage}%)
              </span>
            </button>
          ))}
        </VStack>
      </VStack>
    </DashboardCard>
  );
}

function SegmentBreakdownSkeleton() {
  return (
    <VStack gap="space-16" marginBlock="space-24 space-16">
      <Skeleton variant="text" width={100} height={24} />
      <DashboardGrid
        minColumnWidth="280px"
        gap={{ xs: "space-16", md: "space-24" }}
      >
        <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="rounded" height={60} />
          </VStack>
        </DashboardCard>
        <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
          <VStack gap="space-12">
            <Skeleton variant="text" width={120} height={20} />
            <Skeleton variant="rounded" height={120} />
          </VStack>
        </DashboardCard>
      </DashboardGrid>
    </VStack>
  );
}
