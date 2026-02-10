import { BodyShort, Box } from "@navikt/ds-react";
import styles from "./Charts.module.css";

interface ChartEmptyStateProps {
  message: string;
}

export function ChartEmptyState({ message }: ChartEmptyStateProps) {
  return (
    <Box className={styles.emptyStateCentered}>
      <BodyShort size="small" className={styles.emptyStateMuted}>
        {message}
      </BodyShort>
    </Box>
  );
}
