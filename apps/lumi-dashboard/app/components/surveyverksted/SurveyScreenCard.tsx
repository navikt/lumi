import { PlusIcon, XMarkIcon } from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  Textarea,
  TextField,
  Tooltip,
} from "@navikt/ds-react";
import { useEffect, useRef } from "react";
import { UndoNotice } from "./UndoNotice";
import styles from "./verksted.module.css";

export interface ScreenContent {
  title: string;
  body?: string;
  startLabel?: string;
}

export interface ScreenUndo {
  label: string;
  onUndo: () => void;
  onExpire: () => void;
}

export interface SurveyScreenCardProps {
  /** Accessible name for the section while the screen exists. */
  regionLabel: string;
  /** Section heading, e.g. "INTROSKJERM". */
  eyebrow: string;
  description?: string;
  addLabel: string;
  removeLabel: string;
  /** Shown when the screen has a start button (intro only). */
  startLabelField?: { label: string; placeholder: string };
  value: ScreenContent | undefined;
  /** Transient undo for a just-removed screen, owned by the route. */
  undo: ScreenUndo | null;
  onChange: (value: ScreenContent | undefined) => void;
}

/**
 * Survey-level screen content (intro before the first question, confirmation
 * after submission). Fields commit per keystroke like every other draft
 * field, so the navigation blocker always sees the latest content.
 * Removal is reversible through the same undo pattern as questions and
 * pages: the undo notice takes focus on removal (handled by UndoNotice),
 * and restoring or adding focuses the title field.
 */
export function SurveyScreenCard({
  regionLabel,
  eyebrow,
  description,
  addLabel,
  removeLabel,
  startLabelField,
  value,
  undo,
  onChange,
}: SurveyScreenCardProps) {
  // Removal focuses the undo notice (house pattern, handled by UndoNotice
  // itself). Creation — via the add button or an undo — focuses the title
  // field so keyboard users land in the restored content. Mounting with an
  // existing value must never steal focus.
  const titleRef = useRef<HTMLInputElement | null>(null);
  const hadValueRef = useRef(value !== undefined);
  useEffect(() => {
    const hasValue = value !== undefined;
    if (hasValue && !hadValueRef.current) {
      titleRef.current?.focus();
    }
    hadValueRef.current = hasValue;
  }, [value]);

  if (value === undefined) {
    return (
      <div className={styles.screenCardAbsent}>
        {description ? (
          <BodyShort size="small" className={styles.screenCardDescription}>
            {description}
          </BodyShort>
        ) : null}
        {undo ? (
          <UndoNotice
            label={undo.label}
            onUndo={undo.onUndo}
            onExpire={undo.onExpire}
          />
        ) : null}
        <div>
          <Button
            type="button"
            variant="tertiary"
            size="small"
            icon={<PlusIcon aria-hidden />}
            onClick={() => onChange({ title: "" })}
          >
            {addLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-label={regionLabel} className={styles.screenCard}>
      <div className={styles.conditionHeader}>
        <Detail as="span" className={styles.eyebrow}>
          {eyebrow}
        </Detail>
        <Tooltip content={removeLabel}>
          <Button
            type="button"
            variant="tertiary"
            data-color="neutral"
            size="xsmall"
            icon={<XMarkIcon aria-hidden />}
            aria-label={removeLabel}
            onClick={() => onChange(undefined)}
          />
        </Tooltip>
      </div>
      {description ? (
        <BodyShort size="small" className={styles.screenCardDescription}>
          {description}
        </BodyShort>
      ) : null}
      <TextField
        ref={titleRef}
        label="Tittel"
        size="small"
        value={value.title}
        onChange={(event) => onChange({ ...value, title: event.target.value })}
      />
      <Textarea
        label="Brødtekst (valgfri)"
        size="small"
        minRows={2}
        value={value.body ?? ""}
        onChange={(event) => {
          const body = event.target.value;
          onChange(
            body.length > 0
              ? { ...value, body }
              : { ...value, body: undefined },
          );
        }}
      />
      {startLabelField ? (
        <TextField
          label={startLabelField.label}
          size="small"
          placeholder={startLabelField.placeholder}
          value={value.startLabel ?? ""}
          onChange={(event) => {
            const startLabel = event.target.value;
            // Whitespace-only labels would strip the start button of its
            // accessible name — store them as absent so runtime says "Start".
            onChange(
              startLabel.trim().length > 0
                ? { ...value, startLabel }
                : { ...value, startLabel: undefined },
            );
          }}
        />
      ) : null}
    </section>
  );
}
