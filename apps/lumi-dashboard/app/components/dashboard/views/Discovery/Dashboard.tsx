import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { StatsCards } from "~/components/dashboard/sections/StatsCards";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useDiscoveryStats } from "~/hooks/useDiscoveryStats";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { describeAnalysisBudget } from "~/utils/analysisBudget";
import { DiscoveryAnalysis } from "./index";
import { Skeleton as DiscoveryAnalysisSkeleton } from "./Skeleton";

/**
 * Discovery dashboard — recurring tasks, examples and owner-defined themes.
 */
export function DiscoveryDashboard() {
  const discoveryQuery = useDiscoveryStats();
  const { data, isPending } = discoveryQuery;
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  // Only the analysis depends on the Discovery query. The other sections
  // have their own queries and stay useful when the analysis fails.
  return (
    <>
      <StatsCards />

      {/* Timeline */}
      <TimelineSection title="Antall svar over tid" noun="svar" />

      <DataFetchBoundary
        title="Kunne ikke hente Discovery-data"
        analysisBudgetDescription={describeAnalysisBudget("Discovery-analysen")}
        queries={[discoveryQuery]}
      >
        {/* Discovery Analysis - show skeleton while loading */}
        {isPending ? (
          <DiscoveryAnalysisSkeleton />
        ) : (
          data && <DiscoveryAnalysis data={data} />
        )}
      </DataFetchBoundary>

      {/* Segment breakdown */}
      {surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}

      {/* Device breakdown */}
      <DeviceBreakdownSection />
    </>
  );
}
