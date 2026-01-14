import { Skeleton as AkselSkeleton, HStack, Table } from "@navikt/ds-react";

interface FeedbackTableSkeletonProps {
  showToolbar?: boolean;
}

export function Skeleton({ showToolbar }: FeedbackTableSkeletonProps) {
  // Inline styles to match .table in FeedbackTable.module.css
  const tableContainerStyle: React.CSSProperties = {
    background: "var(--ax-bg-default)",
    borderRadius: "8px",
    boxShadow: "var(--ax-shadow-small)",
    border: "1px solid var(--ax-border-neutral-subtle)",
    overflow: "hidden",
  };

  // Toolbar skeleton styles (matching .toolbar in FeedbackTable.module.css)
  const toolbarStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    background: "var(--ax-bg-neutral-moderate)",
    borderBottom: "1px solid var(--ax-border-neutral-subtle)",
  };

  return (
    <div style={tableContainerStyle}>
      {/* Toolbar skeleton when survey is selected */}
      {showToolbar && (
        <div style={toolbarStyle}>
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
            <Table.HeaderCell style={{ width: 40 }} />
            {/* Date */}
            <Table.HeaderCell style={{ width: 100 }}>Dato</Table.HeaderCell>
            {/* Feedback */}
            <Table.HeaderCell>Tilbakemelding</Table.HeaderCell>
            {/* App */}
            <Table.HeaderCell style={{ width: 200 }}>App</Table.HeaderCell>
            {/* Actions */}
            <Table.HeaderCell style={{ width: 80 }} />
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
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
                <div style={{ display: "flex", gap: "0.5rem" }}>
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
