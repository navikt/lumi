import { Detail, Heading, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { TopTasksTimelineChart } from "~/components/dashboard/views/TopTasks/TimelineChart";
import {
  TimelineChart,
  TimelineChartTable,
  TimelinePartialNote,
  useTimelineInterval,
} from "~/components/shared/Charts/TimelineChart";
import { INTERVAL_NOUNS } from "~/utils/timeBuckets";
import styles from "./TimelineSection.module.css";

interface TimelineSectionProps {
  /**
   * Title for the timeline section.
   * Defaults to "Aktivitet over tid".
   */
  title?: string;
  /**
   * Chart variant to display.
   * - "default": Standard count timeline (TimelineChart)
   * - "topTasks": Success rate timeline (TopTasksTimelineChart)
   */
  variant?: "default" | "topTasks";
}

/**
 * Reusable timeline section for dashboards.
 * Provides consistent styling for timeline charts across all dashboard types.
 */
export function TimelineSection({
  title = "Aktivitet over tid",
  variant = "default",
}: TimelineSectionProps) {
  const interval = useTimelineInterval();
  // The Top Tasks timeline shows one value per day.
  const unit = variant === "topTasks" ? "dag" : INTERVAL_NOUNS[interval].one;

  return (
    <DashboardCard padding={{ xs: "space-12", md: "space-16" }}>
      <VStack gap="space-12">
        <VStack gap="space-2">
          <Heading size="small" level="2">
            {title}
          </Heading>
          <Detail textColor="subtle">Per {unit}</Detail>
        </VStack>
        <div className={styles.chartContainer}>
          {variant === "topTasks" ? (
            <TopTasksTimelineChart />
          ) : (
            <TimelineChart />
          )}
        </div>
        {variant === "topTasks" ? null : <TimelinePartialNote />}
        {variant === "topTasks" ? null : <TimelineChartTable />}
      </VStack>
    </DashboardCard>
  );
}
