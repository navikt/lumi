import { Skeleton as AkselSkeleton } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import styles from "./StatsCards.module.css";

interface StatCardSkeletonProps {
  labelWidth?: number;
}

function StatCardSkeleton({ labelWidth = 140 }: StatCardSkeletonProps) {
  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-20" }}>
      <div className={styles.skeletonHeader}>
        <AkselSkeleton variant="circle" width={24} height={24} />
        <AkselSkeleton variant="text" width={labelWidth} />
      </div>

      <div className={styles.skeletonValue}>
        <AkselSkeleton variant="text" width={100} height={40} />
      </div>

      <AkselSkeleton variant="text" width={120} height={20} />
    </DashboardCard>
  );
}

interface StatsCardsSkeletonProps {
  showRating?: boolean;
}

export function Skeleton({ showRating = false }: StatsCardsSkeletonProps) {
  const columns = { xs: 1, sm: 2, md: showRating ? 4 : 3 };

  return (
    <DashboardGrid columns={columns} gap={{ xs: "space-12", md: "space-16" }}>
      <StatCardSkeleton labelWidth={80} /> {/* Periode */}
      <StatCardSkeleton labelWidth={140} /> {/* Tilbakemeldinger */}
      {showRating && <StatCardSkeleton labelWidth={120} />} {/* Snitt/Rating */}
      <StatCardSkeleton labelWidth={100} /> {/* Tekstsvar/Med tekst */}
    </DashboardGrid>
  );
}
