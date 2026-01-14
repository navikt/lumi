import { Box, Skeleton } from "@navikt/ds-react";

export function ChartLoadingState() {
  return (
    <Box.New style={{ height: "100%", width: "100%" }}>
      <Skeleton variant="rectangle" style={{ height: "100%", width: "100%" }} />
    </Box.New>
  );
}
