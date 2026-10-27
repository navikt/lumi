import { useCallback, useEffect, useState } from "react";
import { readRoom } from "./rooms";

const STORAGE_KEY = "lumi-presentasjon:hurtigtaster-en-tast";

/**
 * The choice is kept apart for the deck with every slide and the talks, so
 * turning the keys off while looking at every slide never takes them from
 * the speaker.
 */
function storageKey(withRoom: boolean): string {
  return `${STORAGE_KEY}:${withRoom ? "rom" : "lenke"}`;
}

function readStored(key: string): boolean | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "on") return true;
    if (value === "off") return false;
    return null;
  } catch {
    return null;
  }
}

function store(key: string, enabled: boolean): void {
  try {
    window.localStorage.setItem(key, enabled ? "on" : "off");
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

export interface SingleKeyShortcuts {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Shortcuts on one character key: digits, G, O, F, B, ".", P and "?".
 * Speech input can set them off by accident (WCAG 2.1.4), so they are off
 * in the deck with every slide and on in a talk's room, where it is given.
 * The choice is remembered, and windows of the same deck follow each other.
 */
export function useSingleKeyShortcuts(): SingleKeyShortcuts {
  const [withRoom] = useState(() => readRoom(window.location.search) !== null);
  const key = storageKey(withRoom);
  const [enabled, setState] = useState(() => readStored(key) ?? withRoom);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      const stored = readStored(key);
      if (stored !== null) setState(stored);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setState(next);
      store(key, next);
    },
    [key],
  );

  return { enabled, setEnabled };
}
