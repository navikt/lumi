import { HGrid } from "@navikt/ds-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type HGridColumns = ComponentPropsWithoutRef<typeof HGrid>["columns"];
type HGridGap = ComponentPropsWithoutRef<typeof HGrid>["gap"];

interface DashboardGridProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * Minimum width for auto-fit columns.
   * Can be a string or responsive object.
   * @default "300px"
   */
  minColumnWidth?:
    | string
    | { xs?: string; sm?: string; md?: string; lg?: string; xl?: string };
  /**
   * Gap between grid items. Uses Aksel spacing tokens.
   * @default { xs: "4", md: "6" }
   */
  gap?: HGridGap;
  /**
   * Explicit column configuration. Overrides minColumnWidth if provided.
   * Use for fixed column layouts (e.g., always 2 columns on desktop).
   */
  columns?: HGridColumns;
  children?: ReactNode;
}

/**
 * Responsive grid layout for dashboard cards and content sections.
 * Uses Aksel HGrid under the hood with sensible defaults for dashboard layouts.
 *
 * @example
 * ```tsx
 * // Auto-fit columns based on min width (default behavior)
 * <DashboardGrid>
 *   <DashboardCard>Card 1</DashboardCard>
 *   <DashboardCard>Card 2</DashboardCard>
 * </DashboardGrid>
 *
 * // Custom min width
 * <DashboardGrid minColumnWidth="240px">...</DashboardGrid>
 *
 * // Fixed column layout
 * <DashboardGrid columns={{ xs: 1, md: 2, lg: 3 }}>...</DashboardGrid>
 * ```
 */
export function DashboardGrid({
  children,
  minColumnWidth = "300px",
  gap = { xs: "space-16", md: "space-24" },
  columns,
  ...props
}: DashboardGridProps) {
  // If explicit columns provided, use them directly
  if (columns) {
    return (
      <HGrid columns={columns} gap={gap} {...props}>
        {children}
      </HGrid>
    );
  }

  // Build responsive auto-fit columns based on minColumnWidth
  const getColumnTemplate = (minWidth: string) =>
    `repeat(auto-fit, minmax(${minWidth}, 1fr))`;

  // Handle responsive minColumnWidth
  let responsiveColumns: HGridColumns;

  if (typeof minColumnWidth === "string") {
    // Simple string: use same min-width at all breakpoints
    // But stack to 1 column on very small screens
    responsiveColumns = {
      xs: 1,
      sm: getColumnTemplate(minColumnWidth),
    };
  } else {
    // Responsive object: build columns for each breakpoint
    responsiveColumns = {};
    if (minColumnWidth.xs)
      responsiveColumns.xs = getColumnTemplate(minColumnWidth.xs);
    if (minColumnWidth.sm)
      responsiveColumns.sm = getColumnTemplate(minColumnWidth.sm);
    if (minColumnWidth.md)
      responsiveColumns.md = getColumnTemplate(minColumnWidth.md);
    if (minColumnWidth.lg)
      responsiveColumns.lg = getColumnTemplate(minColumnWidth.lg);
    if (minColumnWidth.xl)
      responsiveColumns.xl = getColumnTemplate(minColumnWidth.xl);

    // Default to single column on xs if not specified
    if (!responsiveColumns.xs) {
      responsiveColumns.xs = 1;
    }
  }

  return (
    <HGrid columns={responsiveColumns} gap={gap} {...props}>
      {children}
    </HGrid>
  );
}
