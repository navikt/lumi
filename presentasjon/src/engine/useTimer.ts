import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lumi-presentasjon:tid";

interface TimerState {
  running: boolean;
  /** Epoch ms of the last start, when running. */
  startedAt: number;
  /** Time counted before the last start. */
  accumulatedMs: number;
}

const STOPPED: TimerState = { running: false, startedAt: 0, accumulatedMs: 0 };

function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.running === "boolean" &&
    typeof state.startedAt === "number" &&
    typeof state.accumulatedMs === "number"
  );
}

// The timer survives a reload of the presenter window.
function readStoredTimer(): TimerState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isTimerState(parsed) ? parsed : STOPPED;
  } catch {
    return STOPPED;
  }
}

function storeTimer(state: TimerState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Without storage the timer still works, it just resets on reload.
  }
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function useTimer(now: number) {
  const [timer, setTimer] = useState<TimerState>(readStoredTimer);

  useEffect(() => storeTimer(timer), [timer]);

  const start = useCallback(() => {
    setTimer((current) =>
      current.running
        ? current
        : { ...current, running: true, startedAt: Date.now() },
    );
  }, []);
  const pause = useCallback(() => {
    setTimer((current) =>
      current.running
        ? {
            running: false,
            startedAt: 0,
            accumulatedMs:
              current.accumulatedMs +
              Math.max(0, Date.now() - current.startedAt),
          }
        : current,
    );
  }, []);
  const reset = useCallback(() => setTimer(STOPPED), []);

  const elapsedMs =
    timer.accumulatedMs +
    (timer.running ? Math.max(0, now - timer.startedAt) : 0);

  return { elapsedMs, running: timer.running, start, pause, reset };
}
