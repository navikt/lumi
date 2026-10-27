import { useId, useRef } from "react";
import { useModalDialog } from "./useModalDialog";

interface Shortcut {
  keys: readonly string[];
  action: string;
}

const ALWAYS: readonly Shortcut[] = [
  { keys: ["→", "Mellomrom", "Page Down", "Enter"], action: "Neste" },
  { keys: ["←", "Page Up", "Backspace"], action: "Forrige" },
  { keys: ["Home", "End"], action: "Første og siste lysbilde" },
  { keys: ["Esc"], action: "Lukk, eller flytt fokus ut av widgeten" },
];

const SINGLE_KEYS: readonly Shortcut[] = [
  { keys: ["Tall", "Enter"], action: "Gå til lysbilde nummer" },
  { keys: ["G", "O"], action: "Oversikt" },
  { keys: ["F"], action: "Fullskjerm" },
  { keys: ["B", "."], action: "Svart skjerm av og på" },
  { keys: ["L"], action: "Bytt mellom natt, dag og papir" },
  { keys: ["?"], action: "Hurtigtaster" },
];

interface ShortcutTableProps {
  shortcuts: readonly Shortcut[];
  /** Named by this element instead of column headings, under the first table. */
  labelledBy?: string;
}

function ShortcutTable({ shortcuts, labelledBy }: ShortcutTableProps) {
  return (
    <table className="deck-help__table" aria-labelledby={labelledBy}>
      {!labelledBy && (
        <thead>
          <tr>
            <th scope="col">Tast</th>
            <th scope="col">Handling</th>
          </tr>
        </thead>
      )}
      <tbody>
        {shortcuts.map(({ keys, action }) => (
          <tr key={action}>
            <th scope="row">
              {keys.map((key, position) => (
                <span key={key}>
                  {position > 0 && " "}
                  <kbd className="deck-kbd">{key}</kbd>
                </span>
              ))}
            </th>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whether the shortcuts on one character key are on. */
  singleKeys: boolean;
  onSingleKeysChange: (enabled: boolean) => void;
  /** The view also steps on a swipe. */
  swipe?: boolean;
}

export function HelpDialog({
  open,
  onClose,
  singleKeys,
  onSingleKeysChange,
  swipe = false,
}: HelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const switchLabelId = useId();
  const switchHintId = useId();
  useModalDialog(dialogRef, open, onClose);

  return (
    <dialog
      ref={dialogRef}
      className="deck-dialog deck-help"
      aria-labelledby={titleId}
    >
      {open && (
        <>
          <div className="deck-dialog__header">
            <h2 id={titleId} className="deck-dialog__title">
              Hurtigtaster
            </h2>
            <button type="button" className="deck-button" onClick={onClose}>
              Lukk
            </button>
          </div>
          <div className="deck-dialog__body">
            <ShortcutTable shortcuts={ALWAYS} />
            <div className="deck-help__single">
              <label className="deck-switch">
                <input
                  type="checkbox"
                  role="switch"
                  className="deck-switch__input"
                  checked={singleKeys}
                  aria-checked={singleKeys}
                  onChange={(event) => onSingleKeysChange(event.target.checked)}
                  aria-describedby={switchHintId}
                />
                <span className="deck-switch__track" aria-hidden="true" />
                <span id={switchLabelId}>Hurtigtaster med én tast</span>
              </label>
              <p id={switchHintId} className="deck-help__hint">
                Gjelder tastene under. Talestyring kan utløse dem ved et uhell.
              </p>
            </div>
            <ShortcutTable shortcuts={SINGLE_KEYS} labelledBy={switchLabelId} />
            <p className="deck-help__note">
              Når fokus står i widgeten på lysbildet, virker bare Page Up og
              Page Down. Mens du skriver i et tekstfelt, virker ingen av tastene
              over. Trykk Esc eller klikk utenfor for å styre lysbildene igjen.
            </p>
            {swipe && (
              <p className="deck-help__note">
                På berøringsskjerm kan du sveipe til venstre og høyre.
              </p>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
