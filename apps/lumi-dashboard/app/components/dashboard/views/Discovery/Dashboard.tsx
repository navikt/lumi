import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { StatsCards } from "~/components/dashboard/sections/StatsCards";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { useDiscoveryStats } from "~/hooks/useDiscoveryStats";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { Skeleton as DiscoveryAnalysisSkeleton } from "./Skeleton";
import { DiscoveryAnalysis } from "./index";

/**
 * Discovery Dashboard - word cloud, themes, recent responses
 */
export function DiscoveryDashboard() {
  const { data, isPending } = useDiscoveryStats();
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  return (
    <>
      <StatsCards />

      {/* Timeline */}
      <TimelineSection title="Antall svar over tid" />

      {/* Discovery Analysis - show skeleton while loading */}
      {isPending ? (
        <DiscoveryAnalysisSkeleton />
      ) : (
        data && <DiscoveryAnalysis data={data} />
      )}

      {/* Segment breakdown */}
      {surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}

      {/* Device breakdown */}
      <DeviceBreakdownSection />
    </>
  );
}
