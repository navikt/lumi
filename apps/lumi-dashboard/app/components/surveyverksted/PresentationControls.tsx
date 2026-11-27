import { InlineMessage, TextField, ToggleGroup } from "@navikt/ds-react";
import { useCallback, useRef, useState } from "react";
import {
  MAX_PLACEMENT_NOTE_LENGTH,
  type SurveyDisplayMode,
  type SurveyPresentation,
} from "~/types/surveyAuthoring";
import styles from "./verksted.module.css";

/** How wide the preview shows a survey that stands at the content. */
export type InlinePreviewWidth = "full" | "column" | "mobile";

/** The names the author sees for the two display modes. */
export const DISPLAY_MODE_LABELS: Record<SurveyDisplayMode, string> = {
  dock: "Flytende panel",
  inline: "Ved innholdet",
};

/**
 * The note is one line of text. A paste can bring tabs and line separators,
 * which the server does not accept. They become spaces.
 */
const asOneLine = (text: string) =>
  text.replace(/[\p{Cc}\u2028\u2029]+/gu, " ");

const isHighSurrogate = (text: string, index: number) => {
  const unit = text.charCodeAt(index);
  return unit >= 0xd800 && unit <= 0xdbff;
};

const isLowSurrogate = (text: string, index: number) => {
  const unit = text.charCodeAt(index);
  return unit >= 0xdc00 && unit <= 0xdfff;
};

const characterCount = (text: string) => Array.from(text).length;

/** The part of the note that was selected when an edit began. */
export interface NoteSelection {
  start: number;
  end: number;
}

/**
 * How much of the start and of the end of the note the edit kept, in UTF-16
 * units. The selection the edit replaced says it exactly. Without it, the
 * text is compared, and a pasted letter that equals the one it replaced
 * would count as kept.
 */
function keptEnds(
  previous: string,
  edited: string,
  selection?: NoteSelection,
): { start: number; end: number } {
  if (
    selection &&
    selection.start >= 0 &&
    selection.start <= selection.end &&
    selection.end <= previous.length
  ) {
    const before = previous.slice(0, selection.start);
    const after = previous.slice(selection.end);
    if (
      edited.length >= before.length + after.length &&
      edited.startsWith(before) &&
      edited.endsWith(after)
    ) {
      return { start: before.length, end: after.length };
    }
  }
  // Without splitting a character in two.
  const shortest = Math.min(previous.length, edited.length);
  let start = 0;
  while (start < shortest && previous[start] === edited[start]) start += 1;
  if (start > 0 && isHighSurrogate(previous, start - 1)) start -= 1;
  let end = 0;
  while (
    end < shortest - start &&
    previous[previous.length - 1 - end] === edited[edited.length - 1 - end]
  ) {
    end += 1;
  }
  if (end > 0 && isLowSurrogate(previous, previous.length - end)) end -= 1;
  return { start, end };
}

/**
 * The note after an edit, on one line and within the limit, and where the
 * caret goes. Like the browser's own limit, it cuts what the author typed or
 * pasted, and keeps the text before and after it. `selection` is the part
 * of the note that was selected when the edit began. The limit is counted in
 * characters, as the API and the database count. The browser's `maxlength`
 * counts UTF-16 units, so an emoji would count twice and a valid note would
 * be cut short.
 */
export function fitPlacementNote(
  previous: string,
  edited: string,
  selection?: NoteSelection,
): { note: string; caret: number } {
  const { start, end } = keptEnds(previous, edited, selection);
  const before = previous.slice(0, start);
  const after = previous.slice(previous.length - end);
  const room = Math.max(
    0,
    MAX_PLACEMENT_NOTE_LENGTH - characterCount(before) - characterCount(after),
  );
  const inserted = Array.from(
    asOneLine(edited.slice(start, edited.length - end)),
  )
    .slice(0, room)
    .join("");
  return {
    note: before + inserted + after,
    caret: before.length + inserted.length,
  };
}

/**
 * The presentation after the author has changed it. A placement note
 * describes a place at the content, so it leaves the presentation when the
 * author chooses the floating panel. `noteAtTheContent` remembers it, and it
 * comes back if the author chooses the content again.
 */
export function changePresentation(
  previous: SurveyPresentation,
  next: SurveyPresentation,
  noteAtTheContent: string | null,
): { presentation: SurveyPresentation; noteAtTheContent: string | null } {
  if (next.mode === "dock") {
    return {
      presentation: { mode: "dock", placementNote: null },
      noteAtTheContent:
        previous.mode === "inline" ? previous.placementNote : noteAtTheContent,
    };
  }
  return previous.mode === "dock"
    ? {
        presentation: { mode: "inline", placementNote: noteAtTheContent },
        noteAtTheContent,
      }
    : { presentation: next, noteAtTheContent: next.placementNote };
}

/** The text of the note and what was selected in it. */
type NoteBeforeEdit = NoteSelection & { value: string };

const selectionIn = (field: HTMLInputElement): NoteBeforeEdit => ({
  value: field.value,
  start: field.selectionStart ?? field.value.length,
  end: field.selectionEnd ?? field.value.length,
});

/**
 * The placement note. While an input method composes text, as with a dead
 * key or pinyin, the field shows the composition and the note waits for the
 * result: cutting a composition at the limit would break it.
 */
function PlacementNoteField({
  note,
  onChange,
}: {
  note: string | null;
  onChange: (note: string | null) => void;
}) {
  const [composition, setComposition] = useState<string | null>(null);
  const composingRef = useRef(false);
  // The note and its selection when the edit began.
  const beforeEditRef = useRef<NoteBeforeEdit | null>(null);
  const watchEdits = useCallback((field: HTMLInputElement | null) => {
    if (!field) return;
    const remember = () => {
      if (!composingRef.current) beforeEditRef.current = selectionIn(field);
    };
    field.addEventListener("beforeinput", remember);
    return () => field.removeEventListener("beforeinput", remember);
  }, []);

  const keepEdit = (field: HTMLInputElement) => {
    const previous = note ?? "";
    const before = beforeEditRef.current;
    beforeEditRef.current = null;
    const fitted = fitPlacementNote(
      previous,
      field.value,
      before?.value === previous ? before : undefined,
    );
    if (fitted.note !== field.value) {
      // The field shows the note as it is saved, with the caret after what
      // was kept of the edit.
      field.value = fitted.note;
      field.setSelectionRange(fitted.caret, fitted.caret);
    }
    // A character past the limit leaves the note as it was.
    const next = fitted.note || null;
    if (next !== note) onChange(next);
  };

  return (
    <TextField
      ref={watchEdits}
      size="small"
      label="Plassering i appen (valgfritt)"
      description={`For eksempel «Under resultatlisten». Høyst ${MAX_PLACEMENT_NOTE_LENGTH} tegn. Utvikleren ser teksten når dere deler surveyen.`}
      value={composition ?? note ?? ""}
      onCompositionStart={(event) => {
        composingRef.current = true;
        beforeEditRef.current = selectionIn(event.currentTarget);
        setComposition(event.currentTarget.value);
      }}
      onChange={(event) => {
        if (composingRef.current) {
          setComposition(event.currentTarget.value);
          return;
        }
        keepEdit(event.currentTarget);
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        setComposition(null);
        keepEdit(event.currentTarget);
      }}
    />
  );
}

export interface PresentationControlsProps {
  presentation: SurveyPresentation;
  /**
   * Changes the choice that is saved with the draft, and is only called when
   * the choice changes. Leave it out where the presentation is frozen, as in
   * a shared version: the controls then only choose the width of the
   * preview.
   */
  onChange?: (presentation: SurveyPresentation) => void;
  /**
   * True when the API did not say which display the draft has. The choice
   * cannot be changed then: a change would replace a choice nobody has seen.
   */
  unknown?: boolean;
  inlineWidth: InlinePreviewWidth;
  onInlineWidthChange: (width: InlinePreviewWidth) => void;
}

/**
 * The choice of where the survey is shown, placed at the preview it changes.
 * Switching between the two only changes the presentation: questions, pages
 * and logic live in the document, which is not touched.
 */
export function PresentationControls({
  presentation,
  onChange,
  unknown = false,
  inlineWidth,
  onInlineWidthChange,
}: PresentationControlsProps) {
  const isInline = presentation.mode === "inline";
  if (onChange && unknown) {
    return (
      <div className={styles.presentationControls}>
        <InlineMessage status="warning" size="small">
          Visningsvalget kunne ikke hentes, så forhåndsvisningen viser{" "}
          {DISPLAY_MODE_LABELS[presentation.mode].toLowerCase()}. Last siden på
          nytt for å se og endre valget.
        </InlineMessage>
      </div>
    );
  }
  if (!onChange && !isInline) return null;

  return (
    <div className={styles.presentationControls}>
      {onChange ? (
        <ToggleGroup
          label="Visning"
          size="small"
          value={presentation.mode}
          onChange={(mode) =>
            onChange({ ...presentation, mode: mode as SurveyDisplayMode })
          }
        >
          <ToggleGroup.Item value="dock" label={DISPLAY_MODE_LABELS.dock} />
          <ToggleGroup.Item value="inline" label={DISPLAY_MODE_LABELS.inline} />
        </ToggleGroup>
      ) : null}
      {isInline && onChange ? (
        <PlacementNoteField
          note={presentation.placementNote}
          onChange={(placementNote) =>
            onChange({ ...presentation, placementNote })
          }
        />
      ) : null}
      {isInline ? (
        <ToggleGroup
          label="Bredde i forhåndsvisningen"
          size="small"
          value={inlineWidth}
          onChange={(width) => onInlineWidthChange(width as InlinePreviewWidth)}
        >
          <ToggleGroup.Item value="full" label="Full bredde" />
          <ToggleGroup.Item value="column" label="Smal kolonne" />
          <ToggleGroup.Item value="mobile" label="Mobil" />
        </ToggleGroup>
      ) : null}
    </div>
  );
}
