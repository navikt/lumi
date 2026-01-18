import { Box, Skeleton } from "@navikt/ds-react";

export function ChartLoadingState() {
  return (
    <Box style={{ height: "100%", width: "100%" }}>
      <Skeleton variant="rectangle" style={{ height: "100%", width: "100%" }} />
    </Box>
  );
}
