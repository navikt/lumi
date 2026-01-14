import { Heading, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import { DashboardCard } from "~/components/dashboard";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  height?: string;
  children: ReactNode;
}

/**
 * Reusable card wrapper for charts with consistent styling.
 * Provides a title, optional subtitle, and sized container for the chart.
 */
export function ChartCard({
  title,
  subtitle,
  height = "clamp(200px, 40vw, 300px)",
  children,
}: ChartCardProps) {
  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
      <VStack gap="space-16">
        <VStack gap="space-4">
          <Heading size="small">{title}</Heading>
          {subtitle && (
            <span
              style={{
                fontSize: "0.875rem",
                color: "var(--ax-text-neutral-subtle)",
              }}
            >
              {subtitle}
            </span>
          )}
        </VStack>
        <div style={{ height, width: "100%" }}>{children}</div>
      </VStack>
    </DashboardCard>
  );
}
