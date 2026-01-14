import { Skeleton as AkselSkeleton } from "@navikt/ds-react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";

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
            <AkselSkeleton width="40%" height={32} style={{ marginTop: 8 }} />
          </DashboardCard>
        ))}
      </DashboardGrid>

      {/* Timeline skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <AkselSkeleton width="30%" height={24} />
        <AkselSkeleton
          width="100%"
          height={200}
          style={{ marginTop: 16, borderRadius: 8 }}
        />
      </DashboardCard>

      {/* Quadrant chart skeleton */}
      <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
        <AkselSkeleton width="40%" height={24} />
        <AkselSkeleton
          width="100%"
          height={300}
          style={{ marginTop: 16, borderRadius: 8 }}
        />
      </DashboardCard>

      {/* Table skeleton */}
      <DashboardCard padding="0">
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--ax-border-neutral-subtle)",
          }}
        >
          <AkselSkeleton width="50%" height={24} />
        </div>
        <div style={{ padding: "1rem 1.5rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16, marginBottom: 12 }}>
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
