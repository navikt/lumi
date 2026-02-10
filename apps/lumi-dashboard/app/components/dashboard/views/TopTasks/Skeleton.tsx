import { Skeleton as AkselSkeleton } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import styles from "./TopTasks.module.css";

/**
 * Skeleton loading state for TopTasks dashboard view.
 */
export function Skeleton() {
  return (
    <>
      {/* Stats cards skeleton */}
      <DashboardGrid columns={{ xs: 1, sm: 2, md: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <DashboardCard key={i} padding="space-20">
            <AkselSkeleton width="60%" height={20} />
            <AkselSkeleton
              width="40%"
              height={32}
              className={styles.skeletonValue}
            />
          </DashboardCard>
        ))}
      </DashboardGrid>

      {/* Timeline skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <AkselSkeleton width="30%" height={24} />
        <AkselSkeleton
          width="100%"
          height={200}
          className={styles.skeletonChart}
        />
      </DashboardCard>

      {/* Quadrant chart skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <AkselSkeleton width="40%" height={24} />
        <AkselSkeleton
          width="100%"
          height={300}
          className={styles.skeletonChart}
        />
      </DashboardCard>

      {/* Table skeleton */}
      <DashboardCard padding="0">
        <div className={styles.skeletonTableHeader}>
          <AkselSkeleton width="50%" height={24} />
        </div>
        <div className={styles.skeletonTableBody}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonTableRow}>
              <AkselSkeleton width="40%" height={20} />
              <AkselSkeleton width="15%" height={20} />
              <AkselSkeleton width="10%" height={20} />
              <AkselSkeleton width="10%" height={20} />
            </div>
          ))}
        </div>
      </DashboardCard>
    </>
  );
}
