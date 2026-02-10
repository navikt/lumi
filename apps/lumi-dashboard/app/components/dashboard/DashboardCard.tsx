import { Box } from "@navikt/ds-react";
import type { ComponentProps } from "react";
import styles from "./DashboardCard.module.css";

type BoxProps = ComponentProps<typeof Box>;

// Make 'as' optional since we default it to 'div'
export type DashboardCardProps = Omit<BoxProps, "as" | "style"> & {
  as?: BoxProps["as"];
};

export function DashboardCard({
  className,
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
      className={[styles.cardShadow, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
