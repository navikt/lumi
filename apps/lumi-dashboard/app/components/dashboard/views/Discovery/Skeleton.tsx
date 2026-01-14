import { Skeleton as AkselSkeleton, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";

/**
 * Skeleton for Discovery Analysis while loading
 */
export function Skeleton() {
  return (
    <>
      {/* Word frequency skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="40%" />
          <AkselSkeleton variant="rectangle" height={120} />
        </VStack>
      </DashboardCard>

      {/* Themes skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="35%" />
          <VStack gap="space-12">
            <AkselSkeleton variant="rounded" height={60} />
            <AkselSkeleton variant="rounded" height={60} />
          </VStack>
        </VStack>
      </DashboardCard>

      {/* Recent responses skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="30%" />
          <VStack gap="space-8">
            <AkselSkeleton variant="rounded" height={40} />
            <AkselSkeleton variant="rounded" height={40} />
            <AkselSkeleton variant="rounded" height={40} />
          </VStack>
        </VStack>
      </DashboardCard>
    </>
  );
}
