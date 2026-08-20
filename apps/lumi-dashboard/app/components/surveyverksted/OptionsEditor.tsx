import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  XMarkIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Button,
  Detail,
  TextField,
  Tooltip,
} from "@navikt/ds-react";
import { useEffect, useRef, useState } from "react";
import type { MoveDirection } from "~/utils/surveyDocument";
import styles from "./verksted.module.css";

export interface OptionsEditorProps {
  questionId: string;
  options: readonly { value: string; label: string }[];
  onAdd: () => void;
  onUpdateLabel: (index: number, label: string) => void;
  onCommitLabel: (index: number, label: string) => void;
  onUpdateValue: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: MoveDirection) => void;
  lockValues?: boolean;
  lockStructure?: boolean;
  minOptions?: number;
}

/**
 * Choice option rows. Labels are the designer's material; the stable `value`
 * is the analytics identity a developer will meet in code, shown in mono.
 * Enter in the last row adds a new option, Backspace in an empty row removes it.
 */
export function OptionsEditor({
  questionId,
  options,
  onAdd,
  onUpdateLabel,
  onCommitLabel,
  onUpdateValue,
  onRemove,
  onMove,
  lockValues = false,
  lockStructure = false,
  minOptions = 1,
}: OptionsEditorProps) {
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  const previousCount = useRef(options.length);

  useEffect(() => {
    if (options.length > previousCount.current) {
      rowRefs.current[options.length - 1]?.focus();
    }
    previousCount.current = options.length;
  }, [options.length]);

  return (
    <div className={styles.optionsEditor}>
      <BodyShort
        as="span"
        size="small"
        weight="semibold"
        className={styles.optionsLabel}
      >
        Alternativer
      </BodyShort>
      <ol className={styles.optionList}>
        {options.map((option, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional; values change while typing
            key={`${questionId}-${index}`}
            className={styles.optionRow}
          >
            <TextField
              ref={(element) => {
                rowRefs.current[index] = element;
              }}
              label={`Alternativ ${index + 1}`}
              hideLabel
              size="small"
              value={option.label}
              className={styles.optionField}
              onChange={(event) => onUpdateLabel(index, event.target.value)}
              onBlur={() => onCommitLabel(index, option.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (index === options.length - 1 && !lockStructure) onAdd();
                  else rowRefs.current[index + 1]?.focus();
                }
                if (
                  event.key === "Backspace" &&
                  option.label === "" &&
                  options.length > minOptions &&
                  !lockStructure
                ) {
                  event.preventDefault();
                  onRemove(index);
                  rowRefs.current[Math.max(0, index - 1)]?.focus();
                }
              }}
            />
            {lockValues ? null : (
              <OptionValue
                index={index}
                value={option.value}
                duplicate={
                  options.filter((other) => other.value === option.value)
                    .length > 1
                }
                onCommit={(value) => onUpdateValue(index, value)}
              />
            )}
            <div className={styles.optionRowActions}>
              <Tooltip content="Flytt opp">
                <Button
                  type="button"
                  variant="tertiary-neutral"
                  size="xsmall"
                  icon={<ArrowUpIcon aria-hidden />}
                  aria-label={`Flytt alternativ ${index + 1} opp`}
                  disabled={index === 0}
                  onClick={() => onMove(index, "up")}
                />
              </Tooltip>
              <Tooltip content="Flytt ned">
                <Button
                  type="button"
                  variant="tertiary-neutral"
                  size="xsmall"
                  icon={<ArrowDownIcon aria-hidden />}
                  aria-label={`Flytt alternativ ${index + 1} ned`}
                  disabled={index === options.length - 1}
                  onClick={() => onMove(index, "down")}
                />
              </Tooltip>
              <Tooltip content="Fjern alternativ">
                <Button
                  type="button"
                  variant="tertiary-neutral"
                  size="xsmall"
                  icon={<XMarkIcon aria-hidden />}
                  aria-label={`Fjern alternativ ${index + 1}`}
                  disabled={options.length <= minOptions || lockStructure}
                  onClick={() => onRemove(index)}
                />
              </Tooltip>
            </div>
          </li>
        ))}
      </ol>
      {lockStructure ? (
        <Detail>
          Svarene brukes i analysen. Du kan endre teksten, men ikke legge til
          eller fjerne svar.
        </Detail>
      ) : (
        <Button
          type="button"
          variant="tertiary"
          size="small"
          icon={<PlusIcon aria-hidden />}
          onClick={onAdd}
        >
          Legg til alternativ
        </Button>
      )}
    </div>
  );
}

/**
 * The stable identity a developer meets in exported code. Display-first,
 * explicitly editable — changing it changes the analytics identity.
 */
function OptionValue({
  index,
  value,
  duplicate,
  onCommit,
}: {
  index: number;
  value: string;
  duplicate: boolean;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Keystrokes commit straight to the draft so autosave and the navigation
  // blocker see the edit; this only remembers what Escape restores.
  const valueBeforeEditRef = useRef(value);

  useEffect(() => {
    if (editing) {
      fieldRef.current?.focus();
      fieldRef.current?.select();
    }
  }, [editing]);

  const finishEditing = () => {
    setEditing(false);
    if (!value.trim()) onCommit(valueBeforeEditRef.current);
    else if (value !== value.trim()) onCommit(value.trim());
  };

  if (editing) {
    return (
      <TextField
        ref={fieldRef}
        label={`Verdi for alternativ ${index + 1}`}
        hideLabel
        size="small"
        value={value}
        className={styles.optionValueField}
        onChange={(event) => onCommit(event.target.value)}
        onBlur={finishEditing}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finishEditing();
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            onCommit(valueBeforeEditRef.current);
            setEditing(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }
        }}
      />
    );
  }

  return (
    <div className={styles.optionValueBlock}>
      <Tooltip content="Endre verdien utvikleren ser i kode">
        <button
          ref={triggerRef}
          type="button"
          className={styles.optionValue}
          aria-label={`Endre verdi for alternativ ${index + 1}: ${value}`}
          onClick={() => {
            valueBeforeEditRef.current = value;
            setEditing(true);
          }}
        >
          {value}
        </button>
      </Tooltip>
      {duplicate ? (
        <Detail as="span" className={styles.optionValueError}>
          Verdien er i bruk flere ganger
        </Detail>
      ) : null}
    </div>
  );
}
