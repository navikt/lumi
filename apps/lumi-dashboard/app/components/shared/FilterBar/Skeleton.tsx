import {
  Skeleton as AkselSkeleton,
  Box,
  Hide,
  HStack,
  Show,
  VStack,
} from "@navikt/ds-react";
import styles from "./FilterBar.module.css";

interface FilterBarSkeletonProps {
  showDetails?: boolean;
  hasActiveFilters?: boolean;
}

export function Skeleton({
  showDetails,
  hasActiveFilters,
}: FilterBarSkeletonProps) {
  return (
    <VStack gap="space-12" className={styles.root}>
      {/* Mirrors FilterBar layout */}
      <Box
        padding={{ xs: "space-12", md: "space-16" }}
        background="raised"
        borderRadius="12"
        className={styles.card}
        borderColor="neutral-subtle"
        borderWidth="1"
      >
        {/* Desktop layout */}
        <Show above="md">
          <HStack gap="space-12" align="end" justify="space-between" wrap>
            {/* Left side: App/Survey/Search + Filter button */}
            <HStack gap="space-12" align="end" wrap>
              <AkselSkeleton variant="rounded" width={140} height={32} />
              <AkselSkeleton variant="rounded" width={180} height={32} />
              {showDetails && (
                <AkselSkeleton variant="rounded" width={180} height={32} />
              )}
              {showDetails && (
                <AkselSkeleton variant="rounded" width={96} height={32} />
              )}
            </HStack>

            {/* Right side: Period + Reset */}
            <HStack gap="space-8" align="end">
              <AkselSkeleton variant="rounded" width={156} height={34} />
              {hasActiveFilters && (
                <AkselSkeleton variant="rounded" width={96} height={32} />
              )}
            </HStack>
          </HStack>
        </Show>

        {/* Mobile/Tablet layout */}
        <Hide above="md">
          <VStack gap="space-8">
            {/* First row: App + Survey */}
            <HStack gap="space-8" wrap>
              <AkselSkeleton
                variant="rounded"
                height={32}
                className={styles.skeletonMobileGrow}
              />
              <AkselSkeleton
                variant="rounded"
                height={32}
                className={styles.skeletonMobileGrow}
              />
            </HStack>

            {/* Second row: Period + Filter + Reset */}
            <HStack gap="space-8" justify="space-between" align="center">
              <HStack gap="space-8" align="center">
                <AkselSkeleton variant="rounded" width={156} height={34} />
                {showDetails && (
                  <AkselSkeleton variant="rounded" width={96} height={32} />
                )}
              </HStack>
              {hasActiveFilters && (
                <AkselSkeleton variant="rounded" width={32} height={32} />
              )}
            </HStack>

            {/* Third row: Search */}
            {showDetails && <AkselSkeleton variant="rounded" height={32} />}
          </VStack>
        </Hide>
      </Box>
    </VStack>
  );
}
