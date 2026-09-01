import { Detail } from "@navikt/ds-react";
import styles from "./verksted.module.css";

/**
 * Live branch state, mirrored from the preview's answers: whether this
 * conditional question is visible to the respondent right now.
 */
export function LiveVisibilityChip({ visible }: { visible: boolean }) {
  return (
    <Detail as="span" className={styles.liveChip} data-visible={visible}>
      <span className={styles.liveDot} aria-hidden />
      {visible ? "Vises nå" : "Skjult nå"}
    </Detail>
  );
}
