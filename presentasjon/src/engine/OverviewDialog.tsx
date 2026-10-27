import { type KeyboardEvent, useId, useRef } from "react";
import { lastStepOf } from "./navigation";
import { SlidePreview } from "./SlidePreview";
import type { Slide } from "./types";
import { useModalDialog } from "./useModalDialog";

interface OverviewDialogProps {
  open: boolean;
  slides: readonly Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

function columnCount(grid: HTMLElement): number {
  const columns = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter(Boolean).length;
  return Math.max(1, columns);
}

/** Grid of live thumbnails. Arrow keys move, Enter jumps, Esc closes. */
export function OverviewDialog({
  open,
  slides,
  currentIndex,
  onSelect,
  onClose,
}: OverviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalDialog(dialogRef, open, onClose, currentRef);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const grid = event.currentTarget.closest("ol");
    if (!grid) return;
    const buttons = Array.from(
      grid.querySelectorAll<HTMLButtonElement>("[data-overview-index]"),
    );
    let to: number;
    switch (event.key) {
      case "ArrowRight":
        to = from + 1;
        break;
      case "ArrowLeft":
        to = from - 1;
        break;
      case "ArrowDown":
        to = from + columnCount(grid);
        break;
      case "ArrowUp":
        to = from - columnCount(grid);
        break;
      case "Home":
        to = 0;
        break;
      case "End":
        to = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[Math.min(Math.max(to, 0), buttons.length - 1)]?.focus();
  };

  return (
    <dialog
      ref={dialogRef}
      className="deck-dialog deck-overview"
      aria-labelledby={titleId}
    >
      {open && (
        <>
          <div className="deck-dialog__header">
            <h2 id={titleId} className="deck-dialog__title">
              Oversikt
            </h2>
            <button type="button" className="deck-button" onClick={onClose}>
              Lukk
            </button>
          </div>
          <ol className="deck-overview__grid">
            {slides.map((slide, index) => {
              const current = index === currentIndex;
              return (
                <li
                  key={slide.id}
                  className="deck-overview__item"
                  data-current={current ? "" : undefined}
                >
                  <SlidePreview
                    slides={slides}
                    position={{ index, step: lastStepOf(slide) }}
                    className="deck-overview__thumb"
                  />
                  <button
                    ref={current ? currentRef : undefined}
                    type="button"
                    className="deck-overview__button"
                    aria-current={current ? "true" : undefined}
                    data-overview-index={index}
                    onClick={() => onSelect(index)}
                    onKeyDown={(event) => moveFocus(event, index)}
                  >
                    <span className="deck-overview__number">{index + 1}</span>
                    <span className="deck-overview__title">{slide.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </dialog>
  );
}
