import { Detail, Heading, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import {
  TopTasksTimelineChart,
  TopTasksTimelinePartialNote,
  TopTasksTimelineTable,
  useSuccessRateSeries,
} from "~/components/dashboard/views/TopTasks/TimelineChart";
import {
  TimelineChart,
  TimelineChartTable,
  type TimelineNoun,
  TimelinePartialNote,
  useCountSeries,
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
  /** What the count chart counts, as the title names it. */
  noun?: TimelineNoun;
}

/**
 * Reusable timeline section for dashboards.
 * Provides consistent styling for timeline charts across all dashboard types.
 */
export function TimelineSection({
  title = "Aktivitet over tid",
  variant = "default",
  noun = "tilbakemeldinger",
}: TimelineSectionProps) {
  return (
    <DashboardCard padding={{ xs: "space-12", md: "space-16" }}>
      {variant === "topTasks" ? (
        <TopTasksTimeline title={title} />
      ) : (
        <CountTimeline title={title} noun={noun} />
      )}
    </DashboardCard>
  );
}

/**
 * The heading, with the resolution under it once the numbers are there. The
 * server leaves the resolution out, as it depends on today's date.
 */
function TimelineHeading({ title, unit }: { title: string; unit?: string }) {
  return (
    <VStack gap="space-2">
      <Heading size="small" level="2">
        {title}
      </Heading>
      {unit ? <Detail textColor="subtle">Per {unit}</Detail> : null}
    </VStack>
  );
}

function CountTimeline({ title, noun }: { title: string; noun: TimelineNoun }) {
  const { series, isPending } = useCountSeries();

  return (
    <VStack gap="space-12">
      <TimelineHeading
        title={title}
        unit={series ? INTERVAL_NOUNS[series.interval].one : undefined}
      />
      <div className={styles.chartContainer}>
        <TimelineChart series={series} isPending={isPending} noun={noun} />
      </div>
      {series ? <TimelinePartialNote series={series} /> : null}
      {series ? <TimelineChartTable series={series} noun={noun} /> : null}
    </VStack>
  );
}

function TopTasksTimeline({ title }: { title: string }) {
  const { series, isPending, isStale } = useSuccessRateSeries();

  return (
    <VStack gap="space-12">
      <TimelineHeading
        title={title}
        unit={series ? INTERVAL_NOUNS[series.interval].one : undefined}
      />
      <div className={styles.chartContainer}>
        <TopTasksTimelineChart
          series={series}
          isPending={isPending}
          isStale={isStale}
        />
      </div>
      {series ? <TopTasksTimelinePartialNote series={series} /> : null}
      {series ? (
        <TopTasksTimelineTable series={series} isStale={isStale} />
      ) : null}
    </VStack>
  );
}
