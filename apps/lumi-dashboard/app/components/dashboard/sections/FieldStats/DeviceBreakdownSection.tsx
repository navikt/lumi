import { Heading, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import { DeviceBreakdownChart } from "~/components/shared/Charts/DeviceBreakdownChart";

interface DeviceBreakdownSectionProps {
  /** Override rating visibility. If not provided, auto-detects based on survey type. */
  showRating?: boolean;
}

/**
 * Reusable device breakdown section for dashboards.
 * Provides consistent styling and removes unnecessary fixed height wrapper.
 */
export function DeviceBreakdownSection({
  showRating,
}: DeviceBreakdownSectionProps = {}) {
  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
      <VStack gap="space-16">
        <Heading size="small">Enheter</Heading>
        <div style={{ width: "100%" }}>
          <DeviceBreakdownChart showRating={showRating} />
        </div>
      </VStack>
    </DashboardCard>
  );
}
