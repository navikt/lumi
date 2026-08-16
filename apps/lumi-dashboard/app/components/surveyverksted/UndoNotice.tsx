import { Button, Detail } from "@navikt/ds-react";
import { useEffect, useRef } from "react";
import styles from "./verksted.module.css";

const EXPIRY_MS = 6000;

/**
 * Inline restore affordance shown where a deleted question or page stood.
 * Focus lands on the undo button so keyboard users can recover instantly,
 * and the notice never expires away from under a focused user.
 */
export function UndoNotice({
  label,
  onUndo,
  onExpire,
}: {
  label: string;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    buttonRef.current?.focus();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const pause = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const arm = () => {
    pause();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onExpireRef.current();
    }, EXPIRY_MS);
  };

  return (
    <div
      className={styles.undoNotice}
      role="status"
      onFocus={pause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) arm();
      }}
    >
      <Detail as="span">{label}</Detail>
      <Button
        ref={buttonRef}
        type="button"
        variant="secondary-neutral"
        size="xsmall"
        onClick={onUndo}
      >
        Angre
      </Button>
    </div>
  );
}
