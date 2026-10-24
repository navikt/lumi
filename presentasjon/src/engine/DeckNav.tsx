import { type ReactNode, useEffect, useState } from "react";

/** The strip fades after this long without the mouse moving or a touch. */
const HIDE_AFTER_MS = 3000;

function useFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(() =>
    Boolean(document.fullscreenElement),
  );
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return fullscreen;
}

/** True for a while after the mouse moves or the screen is touched. */
function usePointerActivity(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const wake = () => {
      setActive(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setActive(false), HIDE_AFTER_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      // A still mouse can report a move when the content under it changes.
      if (event.clientX === lastX && event.clientY === lastY) return;
      lastX = event.clientX;
      lastY = event.clientY;
      wake();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", wake);
      window.clearTimeout(timer);
    };
  }, []);
  return active;
}

interface NavButtonProps {
  onClick: () => void;
  children: ReactNode;
}

/**
 * A click leaves focus where it was, so the keys go on driving the deck
 * and the strip can fade. Tab still reaches the button.
 */
function NavButton({ onClick, children }: NavButtonProps) {
  return (
    <button
      type="button"
      className="deck-button deck-nav__button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface DeckNavProps {
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onHelp: () => void;
}

/**
 * Previous, next and the shortcuts for people without a keyboard, at the
 * bottom centre of the audience view. It shows when the mouse moves, the
 * screen is touched or focus is in it, and fades after a pause, but never
 * while it has focus. In fullscreen only focus shows it, so the stage and
 * the Teams corner stay clean while the talk is given.
 */
export function DeckNav({
  index,
  total,
  onPrevious,
  onNext,
  onHelp,
}: DeckNavProps) {
  const active = usePointerActivity();
  const fullscreen = useFullscreen();
  const [focusInside, setFocusInside] = useState(false);
  const [hovered, setHovered] = useState(false);
  const shown = focusInside || (!fullscreen && (active || hovered));

  return (
    <nav
      className="deck-nav"
      aria-label="Lysbilder"
      data-shown={shown ? "" : undefined}
      onFocus={() => setFocusInside(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusInside(false);
        }
      }}
      onPointerEnter={(event) => setHovered(event.pointerType === "mouse")}
      onPointerLeave={() => setHovered(false)}
    >
      <NavButton onClick={onPrevious}>Forrige</NavButton>
      <p className="deck-nav__position">
        <span className="deck-sr-only">Lysbilde </span>
        {index + 1} av {total}
      </p>
      <NavButton onClick={onNext}>Neste</NavButton>
      <NavButton onClick={onHelp}>Hurtigtaster</NavButton>
    </nav>
  );
}
