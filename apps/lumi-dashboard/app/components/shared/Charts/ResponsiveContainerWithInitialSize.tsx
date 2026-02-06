import type React from "react";
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

type RechartsResponsiveContainerProps = React.ComponentProps<
  typeof RechartsResponsiveContainer
>;

export function ResponsiveContainerWithInitialSize({
  initialDimension,
  ...props
}: RechartsResponsiveContainerProps) {
  return (
    <RechartsResponsiveContainer
      initialDimension={initialDimension ?? { width: 1, height: 1 }}
      {...props}
    />
  );
}
