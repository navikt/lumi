import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTaskPriorityStats } from "~/hooks/useTaskPriorityStats";
import { Skeleton as TaskPriorityAnalysisSkeleton } from "./Skeleton";
import { TaskPriorityAnalysis } from "./index";

/**
 * Task Priority Dashboard - Long Neck chart, vote distribution
 */
export function TaskPriorityDashboard() {
  const { data, isPending } = useTaskPriorityStats();
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  return (
    <>
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
    </>
  );
}
