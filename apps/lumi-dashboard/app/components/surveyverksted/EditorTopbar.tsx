import {
  ArrowLeftIcon,
  CogIcon,
  ExternalLinkIcon,
  PencilIcon,
} from "@navikt/aksel-icons";
import { Button, Detail, HStack, TextField, Tooltip } from "@navikt/ds-react";
import { memo, useEffect, useRef, useState } from "react";
import styles from "./verksted.module.css";

export type SaveState = "saved" | "saving" | "error" | "missing";

const SAVE_TEXT: Record<SaveState, string> = {
  saved: "Lagret",
  saving: "Lagrer …",
  error: "Ikke lagret",
  missing: "Mangler navn eller ID",
};

export interface EditorTopbarProps {
  name: string;
  surveyId: string;
  team: string;
  saveState: SaveState;
  previewHref: string | null;
  onRename: (name: string) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
}

export const EditorTopbar = memo(function EditorTopbar({
  name,
  surveyId,
  team,
  saveState,
  previewHref,
  onRename,
  onBack,
  onOpenSettings,
  onOpenShare,
}: EditorTopbarProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  // Every keystroke commits to the draft so autosave and the navigation
  // blocker always see the name being typed; this only remembers what to
  // restore on Escape or an empty blur.
  const nameBeforeEditRef = useRef(name);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  const finishEditing = () => {
    setEditing(false);
    if (!name.trim()) onRename(nameBeforeEditRef.current);
    else if (name !== name.trim()) onRename(name.trim());
  };

  // Announce only meaningful transitions to screen readers: errors, the
  // FIRST successful save, and recovery after an error. Routine autosaves
  // stay quiet so the live region never narrates every keystroke pause.
  const [announcement, setAnnouncement] = useState("");
  const previousSaveState = useRef<SaveState>(saveState);
  const hasAnnouncedSave = useRef(false);
  const lastWasError = useRef(false);
  useEffect(() => {
    const previous = previousSaveState.current;
    previousSaveState.current = saveState;
    if (saveState === previous) return;
    if (saveState === "error") {
      setAnnouncement("Utkastet ble ikke lagret");
      lastWasError.current = true;
      return;
    }
    if (
      saveState === "saved" &&
      previous === "saving" &&
      (!hasAnnouncedSave.current || lastWasError.current)
    ) {
      setAnnouncement("Lagret");
      hasAnnouncedSave.current = true;
      lastWasError.current = false;
    }
  }, [saveState]);

  return (
    <header className={styles.topbar}>
      <HStack gap="space-8" align="center" className={styles.topbarIdentity}>
        <Tooltip content="Til Surveyverksted">
          <Button
            type="button"
            variant="tertiary-neutral"
            size="small"
            icon={<ArrowLeftIcon aria-hidden />}
            aria-label="Til Surveyverksted"
            onClick={onBack}
          />
        </Tooltip>
        <div className={styles.topbarTitleBlock}>
          {editing ? (
            <TextField
              ref={editRef}
              label="Navn på utkastet"
              hideLabel
              size="small"
              value={name}
              error={name.trim() ? undefined : "Navn er påkrevd"}
              className={styles.topbarTitleField}
              onChange={(event) => onRename(event.target.value)}
              onBlur={finishEditing}
              onKeyDown={(event) => {
                if (event.key === "Enter") finishEditing();
                if (event.key === "Escape") {
                  onRename(nameBeforeEditRef.current);
                  setEditing(false);
                  requestAnimationFrame(() => titleButtonRef.current?.focus());
                }
              }}
            />
          ) : (
            <h1 className={styles.topbarHeading}>
              <button
                ref={titleButtonRef}
                type="button"
                className={styles.topbarTitle}
                onClick={() => {
                  nameBeforeEditRef.current = name;
                  setEditing(true);
                }}
                aria-label={`Endre navn på utkastet: ${name || "Uten navn"}`}
              >
                <span className={styles.topbarTitleText}>
                  {name || "Uten navn"}
                </span>
                <PencilIcon aria-hidden className={styles.topbarTitlePencil} />
              </button>
            </h1>
          )}
          <Detail as="p" className={styles.topbarMeta}>
            <span className={styles.mono}>{surveyId || "mangler-id"}</span>
            <span aria-hidden> · </span>
            {team}
          </Detail>
        </div>
      </HStack>

      <HStack gap="space-8" align="center" className={styles.topbarActions}>
        <span
          className={styles.saveWhisper}
          data-state={saveState}
          aria-hidden="true"
        >
          <span className={styles.saveDot} />
          {SAVE_TEXT[saveState]}
        </span>
        <span role="status" className={styles.srOnly}>
          {announcement}
        </span>
        <Tooltip content="Innstillinger for utkastet">
          <Button
            type="button"
            variant="tertiary-neutral"
            size="small"
            icon={<CogIcon aria-hidden />}
            aria-label="Innstillinger for utkastet"
            onClick={onOpenSettings}
          />
        </Tooltip>
        {previewHref ? (
          <Button
            as="a"
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size="small"
            icon={<ExternalLinkIcon aria-hidden />}
          >
            Prøv surveyen
          </Button>
        ) : (
          <Tooltip content="Tilgjengelig når utkastet er lagret">
            <Button
              type="button"
              variant="secondary"
              size="small"
              icon={<ExternalLinkIcon aria-hidden />}
              disabled
            >
              Prøv surveyen
            </Button>
          </Tooltip>
        )}
        <Button type="button" size="small" onClick={onOpenShare}>
          Del med utvikler
        </Button>
      </HStack>
    </header>
  );
});
