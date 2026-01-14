import { BodyShort, Heading, VStack } from "@navikt/ds-react";
import {
  ChartCard,
  DashboardCard,
  DashboardGrid,
} from "~/components/dashboard";
import { SegmentBreakdown } from "~/components/dashboard/SegmentBreakdown";
import { FieldStatsSection } from "~/components/dashboard/sections/FieldStats";
import { DeviceBreakdownSection } from "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection";
import { StatsCards } from "~/components/dashboard/sections/StatsCards";
import { TimelineSection } from "~/components/dashboard/sections/Timeline";
import { UrgentUrls } from "~/components/dashboard/sections/UrgentUrls";
import { RatingChart } from "~/components/shared/Charts/RatingChart";
import { RatingTrendChart } from "~/components/shared/Charts/RatingTrendChart";
import { TopAppsChart } from "~/components/shared/Charts/TopAppsChart";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";

interface RatingDashboardProps {
  hasSurveyFilter?: boolean;
}

/**
 * Rating Dashboard - rating chart, trend, top apps
 */
export function RatingDashboard({ hasSurveyFilter }: RatingDashboardProps) {
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const surveyId = params.surveyId;

  return (
    <>
      <StatsCards showRating />

      <TimelineSection title="Antall tilbakemeldinger" />

      {/* Overview charts - only shown when no specific survey is selected */}
      {!hasSurveyFilter && (
        <>
          <DashboardGrid minColumnWidth="280px">
            <ChartCard title="Vurderingsfordeling" height="260px">
              <RatingChart />
            </ChartCard>
            <ChartCard title="Topp apper" height="260px">
              <TopAppsChart />
            </ChartCard>
          </DashboardGrid>

          <DashboardGrid>
            <DashboardCard padding={{ xs: "space-12", md: "space-16" }}>
              <VStack gap="space-12">
                <VStack gap="space-4">
                  <Heading size="small">Gjennomsnittlig vurdering</Heading>
                  <BodyShort size="small" textColor="subtle">
                    Kun rating-surveys
                  </BodyShort>
                </VStack>
                <div
                  style={{
                    height: "260px",
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  <RatingTrendChart />
                </div>
              </VStack>
            </DashboardCard>
          </DashboardGrid>

          {/* Urgent URLs - full width (only on overview) */}
          <UrgentUrls />
        </>
      )}

      {/* Field statistics - only when a survey is selected */}
      {hasSurveyFilter && <FieldStatsSection />}

      {/* Segment breakdown for survey-specific view */}
      {hasSurveyFilter && surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}

      {/* Device breakdown - at the bottom for consistency across all dashboards */}
      <DeviceBreakdownSection />
    </>
  );
}
