import { Box } from "@navikt/ds-react";
import type { ComponentProps } from "react";

// Use ComponentProps to get the exact props expected by Box.New
type BoxNewProps = ComponentProps<typeof Box.New>;

// Make 'as' optional since we default it to 'div'
export type DashboardCardProps = Omit<BoxNewProps, "as"> & {
  as?: BoxNewProps["as"];
};

export function DashboardCard({
  style,
  as = "div",
  ...props
}: DashboardCardProps) {
  return (
    <Box.New
      as={as}
      padding="space-24"
      background="raised"
      borderRadius="large"
      borderWidth="1"
      borderColor="neutral-subtle"
      style={{
        boxShadow: "var(--ax-shadow-small)",
        ...style,
      }}
      {...props}
    />
  );
}
