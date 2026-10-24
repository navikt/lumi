import { useEffect, useLayoutEffect, useRef } from "react";
import { INTERACTIVE_SELECTOR } from "./keyboard";

/** Shortest sideways travel that counts as a swipe, in CSS pixels. */
const MIN_DISTANCE = 56;

/** Swipes that start on a control or in the live widget belong to it. */
const IGNORED = `${INTERACTIVE_SELECTOR}, .live-survey, .deck-nav`;

export interface SwipeActions {
  next: () => void;
  previous: () => void;
}

/**
 * On a touch screen, a swipe to the left goes one step forward and a swipe
 * to the right one step back. Mostly vertical moves, pinches and swipes on
 * a zoomed-in page are left to the browser.
 */
export function useSwipe(actions: SwipeActions, enabled: boolean): void {
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(IGNORED)) return;
      if ((window.visualViewport?.scale ?? 1) > 1) return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = (event: TouchEvent) => {
      const from = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!from || !touch || event.touches.length > 0) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) {
        return;
      }
      if (dx < 0) actionsRef.current.next();
      else actionsRef.current.previous();
    };
    const onTouchCancel = () => {
      start = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);
}
