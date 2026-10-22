import { useEffect, useRef } from "react";

/**
 * Aksel disables a button while it loads, and the browser then moves focus
 * away from it. This gives focus back to the button when loading ends, if the
 * button had focus when it was pressed and nothing else has taken focus since,
 * for example a message the result moved focus to.
 */
export function useFocusAfterLoading<T extends HTMLElement = HTMLButtonElement>(
  loading: boolean,
) {
  const ref = useRef<T>(null);
  const hadFocus = useRef(false);

  useEffect(() => {
    if (loading || !hadFocus.current) return;
    hadFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) ref.current?.focus();
  }, [loading]);

  /** Call when the button is pressed, before the action starts loading. */
  const remember = () => {
    hadFocus.current = document.activeElement === ref.current;
  };

  return { ref, remember };
}
