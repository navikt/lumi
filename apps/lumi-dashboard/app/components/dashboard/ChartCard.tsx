import { Heading, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";
import { DashboardCard } from "~/components/dashboard";
import styles from "./ChartCard.module.css";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  size?: "default" | "compact";
  children: ReactNode;
  /** Shown under the sized chart area, for example the chart's numbers as a table. */
  table?: ReactNode;
}

/**
 * Reusable card wrapper for charts with consistent styling.
 * Provides a title, optional subtitle, and sized container for the chart.
 */
export function ChartCard({
  title,
  subtitle,
  size = "default",
  children,
  table,
}: ChartCardProps) {
  const chartHeightClass =
    size === "compact" ? styles.chartCompact : styles.chartDefault;

  return (
    <DashboardCard padding={{ xs: "space-16", md: "space-24" }}>
      <VStack gap="space-16">
        <VStack gap="space-4">
          <Heading size="small" level="2">
            {title}
          </Heading>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </VStack>
        <div className={chartHeightClass}>{children}</div>
        {table}
      </VStack>
    </DashboardCard>
  );
}
