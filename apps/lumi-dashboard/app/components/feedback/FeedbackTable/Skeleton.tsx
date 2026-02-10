import { Skeleton as AkselSkeleton, HStack, Table } from "@navikt/ds-react";
import styles from "./styles.module.css";

interface FeedbackTableSkeletonProps {
  showToolbar?: boolean;
}

export function Skeleton({ showToolbar }: FeedbackTableSkeletonProps) {
  return (
    <div className={styles.table}>
      {/* Toolbar skeleton when survey is selected */}
      {showToolbar && (
        <div className={styles.toolbar}>
          <HStack justify="space-between" align="center">
            <AkselSkeleton variant="text" width={280} height={20} />
            <AkselSkeleton variant="rounded" width={130} height={32} />
          </HStack>
        </div>
      )}
      <Table>
        <Table.Header>
          <Table.Row>
            {/* Expand toggle */}
            <Table.HeaderCell className={styles.headerCellExpand} />
            {/* Date */}
            <Table.HeaderCell className={styles.headerCellDate}>
              Dato
            </Table.HeaderCell>
            {/* Feedback */}
            <Table.HeaderCell>Tilbakemelding</Table.HeaderCell>
            {/* App */}
            <Table.HeaderCell className={styles.headerCellApp}>
              App
            </Table.HeaderCell>
            {/* Actions */}
            <Table.HeaderCell className={styles.headerCellActions} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Array.from({ length: 10 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton list is static and never re-orders
            <Table.Row key={i}>
              {/* Expand Toggle Skeleton */}
              <Table.DataCell>
                <AkselSkeleton variant="circle" width={24} height={24} />
              </Table.DataCell>
              {/* Date Skeleton */}
              <Table.DataCell>
                <AkselSkeleton variant="text" width={70} />
              </Table.DataCell>
              {/* Feedback Content Skeleton */}
              <Table.DataCell>
                {/* Randomize widths slightly for organic feel */}
                <div className={styles.skeletonFeedbackLines}>
                  <AkselSkeleton
                    variant="text"
                    width={`${[85, 92, 65, 78, 90, 60, 88, 72, 95, 68][i % 10]}%`}
                  />
                  {i % 3 === 0 && <AkselSkeleton variant="text" width="40%" />}
                </div>
              </Table.DataCell>
              {/* App Name Skeleton */}
              <Table.DataCell>
                <AkselSkeleton variant="text" width={120} />
              </Table.DataCell>
              {/* Actions Skeleton */}
              <Table.DataCell>
                <div className={styles.skeletonActionButtons}>
                  <AkselSkeleton variant="rounded" width={24} height={24} />
                  <AkselSkeleton variant="rounded" width={24} height={24} />
                </div>
              </Table.DataCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
