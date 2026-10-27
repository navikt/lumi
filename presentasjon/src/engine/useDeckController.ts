import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampPosition,
  formatHash,
  lastStepOf,
  nextPosition,
  parseHash,
  previousPosition,
} from "./navigation";
import type { DeckPosition, Slide } from "./types";

export interface DeckState extends DeckPosition {
  black: boolean;
}

export interface DeckController {
  state: DeckState;
  goTo: (position: DeckPosition) => void;
  /** 1-based slide number, opened at its first step. */
  goToSlide: (number: number) => void;
  next: () => void;
  previous: () => void;
  first: () => void;
  last: () => void;
  setBlack: (black: boolean) => void;
  toggleBlack: () => void;
}

type SyncMessage = { type: "hello" } | { type: "state"; state: DeckState };

function isSyncMessage(value: unknown): value is SyncMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as { type?: unknown; state?: unknown };
  if (message.type === "hello") return true;
  if (message.type !== "state") return false;
  if (typeof message.state !== "object" || message.state === null) return false;
  const state = message.state as Record<string, unknown>;
  return (
    typeof state.index === "number" &&
    typeof state.step === "number" &&
    typeof state.black === "boolean"
  );
}

function sameState(a: DeckState, b: DeckState): boolean {
  return a.index === b.index && a.step === b.step && a.black === b.black;
}

/** replaceState, so stepping through the deck adds no history entries. */
function writeHash(slides: readonly Slide[], position: DeckPosition): void {
  const hash = formatHash(slides, position);
  if (!hash || window.location.hash === hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${search}${hash}`,
  );
}

/**
 * Deck position and black screen, kept in the URL hash and shared with
 * other windows of the same deck through a BroadcastChannel. Any window
 * can navigate.
 */
export function useDeckController(slides: readonly Slide[]): DeckController {
  const [state, setState] = useState<DeckState>(() => ({
    ...(parseHash(slides, window.location.hash) ?? { index: 0, step: 0 }),
    black: false,
  }));
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const apply = useCallback((next: DeckState, broadcast: boolean) => {
    if (sameState(stateRef.current, next)) return;
    stateRef.current = next;
    setState(next);
    if (broadcast) {
      channelRef.current?.postMessage({
        type: "state",
        state: next,
      } satisfies SyncMessage);
    }
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(
      `lumi-presentasjon:${window.location.pathname}`,
    );
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!isSyncMessage(message)) return;
      if (message.type === "hello") {
        channel.postMessage({
          type: "state",
          state: stateRef.current,
        } satisfies SyncMessage);
        return;
      }
      const position = clampPosition(slides, message.state);
      apply({ ...position, black: message.state.black }, false);
    };
    // A new window asks the others where the deck is.
    channel.postMessage({ type: "hello" } satisfies SyncMessage);
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [apply, slides]);

  const { index, step } = state;
  useEffect(() => {
    writeHash(slides, { index, step });
  }, [slides, index, step]);

  useEffect(() => {
    const onHashChange = () => {
      const position = parseHash(slides, window.location.hash);
      if (position) apply({ ...stateRef.current, ...position }, true);
      // Unknown ids and steps out of range are replaced with the real position.
      writeHash(slides, stateRef.current);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [apply, slides]);

  const goTo = useCallback(
    (position: DeckPosition) => {
      apply({ ...stateRef.current, ...clampPosition(slides, position) }, true);
    },
    [apply, slides],
  );
  const goToSlide = useCallback(
    (number: number) => goTo({ index: number - 1, step: 0 }),
    [goTo],
  );
  const next = useCallback(
    () => goTo(nextPosition(slides, stateRef.current)),
    [goTo, slides],
  );
  const previous = useCallback(
    () => goTo(previousPosition(slides, stateRef.current)),
    [goTo, slides],
  );
  const first = useCallback(() => goTo({ index: 0, step: 0 }), [goTo]);
  const last = useCallback(() => {
    const lastIndex = slides.length - 1;
    goTo({ index: lastIndex, step: lastStepOf(slides[lastIndex]) });
  }, [goTo, slides]);
  const setBlack = useCallback(
    (black: boolean) => apply({ ...stateRef.current, black }, true),
    [apply],
  );
  const toggleBlack = useCallback(
    () => apply({ ...stateRef.current, black: !stateRef.current.black }, true),
    [apply],
  );

  return {
    state,
    goTo,
    goToSlide,
    next,
    previous,
    first,
    last,
    setBlack,
    toggleBlack,
  };
}
