import { Box } from "@navikt/ds-react";
import type { ComponentProps } from "react";

type BoxProps = ComponentProps<typeof Box>;

// Make 'as' optional since we default it to 'div'
export type DashboardCardProps = Omit<BoxProps, "as"> & {
  as?: BoxProps["as"];
};

export function DashboardCard({
  style,
  as = "div",
  ...props
}: DashboardCardProps) {
  return (
    <Box
      as={as}
      padding="space-24"
      background="raised"
      borderRadius="12"
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
