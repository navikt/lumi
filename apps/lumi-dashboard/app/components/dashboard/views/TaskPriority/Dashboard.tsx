import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTaskPriorityStats } from "~/hooks/useTaskPriorityStats";
import { TaskPriorityAnalysis } from "./index";
import { Skeleton as TaskPriorityAnalysisSkeleton } from "./Skeleton";

/**
 * Task Priority Dashboard - Long Neck chart, vote distribution
 */
export function TaskPriorityDashboard() {
  const taskPriorityQuery = useTaskPriorityStats();
  const { data, isPending } = taskPriorityQuery;
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  return (
    <DataFetchBoundary
      title="Kunne ikke hente Task Priority-data"
      queries={[taskPriorityQuery]}
    >
      {/* Task Priority Analysis - show skeleton while loading */}
      {isPending ? (
        <TaskPriorityAnalysisSkeleton />
      ) : (
        data && <TaskPriorityAnalysis data={data} />
      )}

      {/* Timeline */}
      <TimelineSection title="Stemmer over tid" />

      {/* Segment breakdown */}
      {surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}

      {/* Device breakdown */}
      <DeviceBreakdownSection />
    </DataFetchBoundary>
  );
}
