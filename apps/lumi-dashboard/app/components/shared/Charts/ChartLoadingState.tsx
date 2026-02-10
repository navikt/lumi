import { Box, Skeleton } from "@navikt/ds-react";
import styles from "./Charts.module.css";

export function ChartLoadingState() {
  return (
    <Box className={styles.fullSize}>
      <Skeleton variant="rectangle" className={styles.fullSize} />
    </Box>
  );
}
