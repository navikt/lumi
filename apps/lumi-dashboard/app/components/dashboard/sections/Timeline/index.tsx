import { Heading, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { TopTasksTimelineChart } from "~/components/dashboard/views/TopTasks/TimelineChart";
import { TimelineChart } from "~/components/shared/Charts/TimelineChart";
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
  return (
    <DashboardCard padding={{ xs: "space-12", md: "space-16" }}>
      <VStack gap="space-12">
        <Heading size="small">{title}</Heading>
        <div className={styles.chartContainer}>
          {variant === "topTasks" ? (
            <TopTasksTimelineChart />
          ) : (
            <TimelineChart />
          )}
        </div>
      </VStack>
    </DashboardCard>
  );
}
