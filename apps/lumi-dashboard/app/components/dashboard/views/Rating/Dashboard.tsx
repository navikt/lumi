import { PlusIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Button,
  Heading,
  HStack,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useState } from "react";
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
import { MarkerModal } from "~/components/shared/MarkerModal";
import { useMarkers } from "~/hooks/useMarkers";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import type {
  CreateMarkerInput,
  RatingMarker,
  UpdateMarkerInput,
} from "~/types/api";
import styles from "./RatingDashboard.module.css";

const DEFAULT_MARKER_COLOR = "#1C64F2";

interface RatingDashboardProps {
  hasSurveyFilter?: boolean;
  isRatingSurvey?: boolean;
}

/**
 * Rating Dashboard - rating chart, trend, top apps
 */
export function RatingDashboard({
  hasSurveyFilter,
  isRatingSurvey = false,
}: RatingDashboardProps) {
  const { params } = useSearchParams();
  const { addSegment } = useSegmentFilter();
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [editingMarker, setEditingMarker] = useState<RatingMarker>();
  const [pendingDeleteMarkerId, setPendingDeleteMarkerId] = useState<
    string | null
  >(null);

  const surveyId = params.surveyId;
  const canManageMarkers = Boolean(
    hasSurveyFilter && isRatingSurvey && surveyId,
  );

  const markerState = useMarkers(
    canManageMarkers ? surveyId : undefined,
    params.fromDate,
    params.toDate,
  );

  const closeMarkerModal = () => {
    setIsMarkerModalOpen(false);
    setEditingMarker(undefined);
    setPendingDeleteMarkerId(null);
  };

  const openCreateMarkerModal = () => {
    setEditingMarker(undefined);
    setIsMarkerModalOpen(true);
    setPendingDeleteMarkerId(null);
  };

  const openEditMarkerModal = (marker: RatingMarker) => {
    setEditingMarker(marker);
    setIsMarkerModalOpen(true);
    setPendingDeleteMarkerId(null);
  };

  const handleSaveMarker = async (
    input: CreateMarkerInput | ({ id: string } & UpdateMarkerInput),
  ) => {
    try {
      if ("id" in input) {
        const { id, ...updateInput } = input;
        await markerState.updateMarkerAsync({
          id,
          ...updateInput,
        });
      } else {
        await markerState.createMarkerAsync(input);
      }
      closeMarkerModal();
    } catch (_error) {
      // Mutation state handles the error
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    try {
      await markerState.deleteMarkerAsync(markerId);
      closeMarkerModal();
      setPendingDeleteMarkerId(null);
    } catch (_error) {
      // Mutation state handles the error
    }
  };

  return (
    <>
      <StatsCards showRating />

      <TimelineSection title="Antall tilbakemeldinger" />

      {/* Overview charts - only shown when no specific survey is selected */}
      {!hasSurveyFilter && (
        <>
          <DashboardGrid minColumnWidth="280px">
            <ChartCard title="Vurderingsfordeling" size="compact">
              <RatingChart />
            </ChartCard>
            <ChartCard title="Topp apper" size="compact">
              <TopAppsChart />
            </ChartCard>
          </DashboardGrid>

          {/* Urgent URLs - full width (only on overview) */}
          <UrgentUrls />
        </>
      )}

      {/* Rating trend - only when a specific rating survey is selected */}
      {canManageMarkers && (
        <DashboardGrid>
          <DashboardCard padding={{ xs: "space-12", md: "space-16" }}>
            <VStack gap="space-12">
              <HStack justify="space-between" align="center" wrap gap="space-8">
                <Heading size="small">Gjennomsnittlig vurdering</Heading>
                <Button
                  variant="secondary"
                  size="small"
                  icon={<PlusIcon aria-hidden />}
                  onClick={openCreateMarkerModal}
                  disabled={!surveyId}
                >
                  Markør
                </Button>
              </HStack>

              <div className={styles.trendContainer}>
                <RatingTrendChart markers={markerState.markers} />
              </div>

              <VStack gap="space-8" className={styles.markerSection}>
                <Heading size="small" level="3">
                  Markører
                </Heading>

                {markerState.isLoading && (
                  <BodyShort size="small" textColor="subtle">
                    Laster markører...
                  </BodyShort>
                )}

                {!markerState.isLoading && markerState.markers.length === 0 && (
                  <BodyShort size="small" textColor="subtle">
                    Ingen markører i valgt periode.
                  </BodyShort>
                )}

                {markerState.markers.map((marker) => (
                  <div key={marker.id} className={styles.markerItem}>
                    <span
                      className={styles.markerDot}
                      style={{
                        backgroundColor: marker.color ?? DEFAULT_MARKER_COLOR,
                      }}
                    />

                    <VStack gap="space-2" className={styles.markerText}>
                      <BodyShort size="medium" weight="semibold">
                        {dayjs(marker.markerDate).format("DD.MM.YYYY")}:{" "}
                        {marker.label}
                      </BodyShort>
                      {marker.description && (
                        <BodyShort size="medium" textColor="subtle">
                          {marker.description}
                        </BodyShort>
                      )}
                    </VStack>

                    <HStack gap="space-4" className={styles.markerActions}>
                      <Button
                        variant="tertiary"
                        size="small"
                        onClick={() => openEditMarkerModal(marker)}
                      >
                        Rediger
                      </Button>
                      <Button
                        data-color="danger"
                        variant="tertiary"
                        size="small"
                        onClick={() => {
                          if (pendingDeleteMarkerId !== marker.id) {
                            setPendingDeleteMarkerId(marker.id);
                            return;
                          }
                          void handleDeleteMarker(marker.id);
                        }}
                        loading={
                          pendingDeleteMarkerId === marker.id &&
                          markerState.isDeleting
                        }
                      >
                        {pendingDeleteMarkerId === marker.id
                          ? "Bekreft slett"
                          : "Slett"}
                      </Button>
                    </HStack>
                  </div>
                ))}

                {(markerState.isCreating ||
                  markerState.isUpdating ||
                  markerState.isDeleting) && (
                  <BodyShort size="small" textColor="subtle">
                    Oppdaterer markører...
                  </BodyShort>
                )}

                {markerState.error && (
                  <Alert size="small" variant="error">
                    Kunne ikke hente markører.
                  </Alert>
                )}
              </VStack>
            </VStack>
          </DashboardCard>
        </DashboardGrid>
      )}

      {/* Field statistics - only when a survey is selected */}
      {hasSurveyFilter && <FieldStatsSection />}

      {/* Segment breakdown for survey-specific view */}
      {hasSurveyFilter && surveyId && (
        <SegmentBreakdown surveyId={surveyId} onSegmentClick={addSegment} />
      )}

      {/* Device breakdown - at the bottom for consistency across all dashboards */}
      <DeviceBreakdownSection />

      <MarkerModal
        isOpen={isMarkerModalOpen}
        mode={editingMarker ? "edit" : "create"}
        marker={editingMarker}
        fromDate={params.fromDate}
        toDate={params.toDate}
        onClose={closeMarkerModal}
        onSave={handleSaveMarker}
        onDelete={handleDeleteMarker}
        isSubmitting={markerState.isCreating || markerState.isUpdating}
        isDeleting={markerState.isDeleting}
      />
    </>
  );
}
