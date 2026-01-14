import { Skeleton as AkselSkeleton, VStack } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";

/**
 * Skeleton for Task Priority Analysis while loading
 */
export function Skeleton() {
  return (
    <>
      {/* Stats cards skeleton */}
      <DashboardGrid columns={{ xs: 2, sm: 3 }} gap="space-16">
        <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
          <AkselSkeleton variant="text" width="60%" />
          <AkselSkeleton variant="text" width="40%" height={40} />
        </DashboardCard>
        <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
          <AkselSkeleton variant="text" width="60%" />
          <AkselSkeleton variant="text" width="40%" height={40} />
        </DashboardCard>
        <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
          <AkselSkeleton variant="text" width="60%" />
          <AkselSkeleton variant="text" width="40%" height={40} />
        </DashboardCard>
      </DashboardGrid>

      {/* Long neck chart skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <VStack gap="space-16">
          <AkselSkeleton variant="text" width="45%" />
          <VStack gap="space-12">
            {[100, 85, 70, 55, 40].map((width) => (
              <div key={width}>
                <AkselSkeleton variant="text" width="60%" />
                <AkselSkeleton
                  variant="rounded"
                  height={8}
                  width={`${width}%`}
                  style={{ marginTop: "0.25rem" }}
                />
              </div>
            ))}
          </VStack>
        </VStack>
      </DashboardCard>
    </>
  );
}
