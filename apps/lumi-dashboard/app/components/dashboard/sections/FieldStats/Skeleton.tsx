import { Skeleton as AkselSkeleton, VStack } from "@navikt/ds-react";
import { DashboardCard } from "~/components/dashboard";
import styles from "./FieldStatsSkeleton.module.css";

function FieldStatCardSkeleton() {
  return (
    <DashboardCard padding="space-20">
      <div className={styles.headerRow}>
        <AkselSkeleton variant="circle" width={20} height={20} />
        <VStack gap="space-4">
          <AkselSkeleton variant="text" width={120} />
          <AkselSkeleton variant="text" width={100} height={14} />
        </VStack>
      </div>
      <div className={styles.valueBlock}>
        <AkselSkeleton variant="text" width={80} height={40} />
      </div>
      <VStack gap="space-8" className={styles.bars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={styles.barRow}>
            <AkselSkeleton variant="text" width={16} />
            <AkselSkeleton variant="rectangle" width="100%" height={16} />
          </div>
        ))}
      </VStack>
    </DashboardCard>
  );
}

export function Skeleton() {
  return (
    <VStack gap="space-24">
      <div className={styles.title}>
        <AkselSkeleton variant="text" width={150} height={32} />
      </div>
      <div className={styles.grid}>
        <FieldStatCardSkeleton />
        <FieldStatCardSkeleton />
      </div>
    </VStack>
  );
}
