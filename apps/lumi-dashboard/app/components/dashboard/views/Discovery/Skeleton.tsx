import { Skeleton as AkselSkeleton, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";

/**
 * Skeleton for Discovery Analysis while loading
 */
export function Skeleton() {
  return (
    <>
      {/* Recurring expressions and examples */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="40%" />
          <AkselSkeleton variant="text" width="65%" />
          <VStack gap="space-8">
            <AkselSkeleton variant="rounded" height={36} />
            <AkselSkeleton variant="rounded" height={36} />
            <AkselSkeleton variant="rounded" height={36} />
          </VStack>
        </VStack>
      </DashboardCard>

      {/* Owner-defined themes */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="35%" />
          <VStack gap="space-12">
            <AkselSkeleton variant="rounded" height={60} />
            <AkselSkeleton variant="rounded" height={60} />
          </VStack>
        </VStack>
      </DashboardCard>
    </>
  );
}
