import { useId, useRef } from "react";
import { useModalDialog } from "./useModalDialog";

const SHORTCUTS: ReadonlyArray<{ keys: readonly string[]; action: string }> = [
  { keys: ["→", "Mellomrom", "Page Down", "Enter"], action: "Neste" },
  { keys: ["←", "Page Up", "Backspace"], action: "Forrige" },
  { keys: ["Home", "End"], action: "Første og siste lysbilde" },
  { keys: ["Tall", "Enter"], action: "Gå til lysbilde nummer" },
  { keys: ["G", "O"], action: "Oversikt" },
  { keys: ["F"], action: "Fullskjerm" },
  { keys: ["B", "."], action: "Svart skjerm av og på" },
  { keys: ["P"], action: "Presentatørvisning i nytt vindu" },
  { keys: ["?"], action: "Hurtigtaster" },
  { keys: ["Esc"], action: "Lukk, eller flytt fokus ut av widgeten" },
];

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
            <table className="deck-help__table">
              <thead>
                <tr>
                  <th scope="col">Tast</th>
                  <th scope="col">Handling</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(({ keys, action }) => (
                  <tr key={action}>
                    <td>
                      {keys.map((key, position) => (
                        <span key={key}>
                          {position > 0 && " "}
                          <kbd className="deck-kbd">{key}</kbd>
                        </span>
                      ))}
                    </td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="deck-help__note">
              Når fokus står i widgeten på lysbildet, virker bare Page Up og
              Page Down. Mens du skriver i et tekstfelt, virker ingen av tastene
              over. Trykk Esc eller klikk utenfor for å styre lysbildene igjen.
            </p>
          </div>
        </>
      )}
    </dialog>
  );
}
