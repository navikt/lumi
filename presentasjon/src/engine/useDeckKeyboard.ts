import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isInsideSlide, keyScope } from "./keyboard";

export interface DeckKeyboardActions {
  next: () => void;
  previous: () => void;
  first: () => void;
  last: () => void;
  /** 1-based slide number. */
  goToSlide: (number: number) => void;
  toggleOverview: () => void;
  toggleFullscreen: () => void;
  toggleBlack: () => void;
  exitBlack: () => void;
  openHelp: () => void;
  /** Goes on to the next style: night, day, paper. */
  toggleLight?: () => void;
  /** Moves focus out of slide content, so the arrow keys drive the deck again. */
  releaseFocus: () => void;
}

const JUMP_TIMEOUT_MS = 3000;
const JUMP_MAX_DIGITS = 3;

/**
 * Global deck shortcuts. Returns the slide number being typed for a jump
 * (digits, then Enter), or an empty string. The arrow keys, Space, Enter,
 * Page Up/Down, Home, End and Esc always work. Digits and the letter and
 * symbol keys only work with `singleKeys`.
 */
export function useDeckKeyboard(
  actions: DeckKeyboardActions,
  enabled: boolean,
  singleKeys: boolean,
): string {
  const [pendingNumber, setPendingNumber] = useState("");
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (!enabled) return;
    let pending = "";
    let timer: number | undefined;
    const setPending = (value: string) => {
      pending = value;
      setPendingNumber(value);
      window.clearTimeout(timer);
      if (value)
        timer = window.setTimeout(() => setPending(""), JUMP_TIMEOUT_MS);
    };

    const handle = (
      event: KeyboardEvent,
      act: DeckKeyboardActions,
    ): boolean => {
      const { key } = event;
      if (singleKeys && /^\d$/.test(key)) {
        if (!event.repeat)
          setPending(`${pending}${key}`.slice(0, JUMP_MAX_DIGITS));
        return true;
      }
      if (pending && key === "Enter") {
        const number = Number.parseInt(pending, 10);
        setPending("");
        if (number > 0) act.goToSlide(number);
        return true;
      }
      if (pending && key === "Backspace") {
        setPending(pending.slice(0, -1));
        return true;
      }
      if (pending) setPending("");

      switch (key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
        case "Enter":
          act.next();
          return true;
        case "ArrowLeft":
        case "PageUp":
        case "Backspace":
          act.previous();
          return true;
        case "Home":
          act.first();
          return true;
        case "End":
          act.last();
          return true;
      }

      if (event.repeat || !singleKeys) return false;
      switch (key.toLowerCase()) {
        case "g":
        case "o":
          act.toggleOverview();
          return true;
        case "f":
          act.toggleFullscreen();
          return true;
        case "b":
        case ".":
          act.toggleBlack();
          return true;
        case "?":
          act.openHelp();
          return true;
        case "l":
          if (!act.toggleLight) return false;
          act.toggleLight();
          return true;
      }
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      const act = actionsRef.current;
      const target = event.target instanceof Element ? event.target : null;
      const scope = keyScope(target);

      if (event.key === "Escape") {
        if (pending) setPending("");
        else if (isInsideSlide(target)) act.releaseFocus();
        else act.exitBlack();
        return;
      }
      if (scope === "text") return;
      if (
        scope === "slide-control" &&
        event.key !== "PageUp" &&
        event.key !== "PageDown"
      ) {
        return;
      }
      // Enter after typed digits is a jump, not a press on the focused button.
      const activatesControl =
        event.key === " " || (event.key === "Enter" && !pending);
      if (scope === "control" && activatesControl) return;
      if (handle(event, act)) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
      setPendingNumber("");
    };
  }, [enabled, singleKeys]);

  return pendingNumber;
}
