import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "lumi-presentasjon:svar";

interface AnswerStore {
  /** The last answer given in the live widget. It is never sent anywhere. */
  payload: LumiSurveyTransportPayload | null;
  setPayload: (payload: LumiSurveyTransportPayload) => void;
  clear: () => void;
}

const AnswerContext = createContext<AnswerStore | null>(null);

type AnswerMessage =
  | { type: "hello" }
  | { type: "answer"; payload: LumiSurveyTransportPayload | null };

function isAnswerMessage(value: unknown): value is AnswerMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as { type?: unknown; payload?: unknown };
  if (message.type === "hello") return true;
  return (
    message.type === "answer" &&
    (message.payload === null || typeof message.payload === "object")
  );
}

function readStored(): LumiSurveyTransportPayload | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LumiSurveyTransportPayload) : null;
  } catch {
    return null;
  }
}

function writeStored(payload: LumiSurveyTransportPayload | null): void {
  try {
    if (payload) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Blocked storage: the answer stays in memory for this window only.
  }
}

/**
 * Keeps the answer from the opening slide so a later slide can follow it
 * through Lumi. Shared with the presenter window, kept for the browser tab.
 */
export function AnswerProvider({ children }: { children: ReactNode }) {
  const [payload, setState] = useState(readStored);
  const payloadRef = useRef(payload);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const apply = useCallback(
    (next: LumiSurveyTransportPayload | null, broadcast: boolean) => {
      payloadRef.current = next;
      setState(next);
      writeStored(next);
      if (broadcast) {
        channelRef.current?.postMessage({
          type: "answer",
          payload: next,
        } satisfies AnswerMessage);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(
      `lumi-presentasjon-svar:${window.location.pathname}`,
    );
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!isAnswerMessage(message)) return;
      if (message.type === "hello") {
        if (payloadRef.current) {
          channel.postMessage({
            type: "answer",
            payload: payloadRef.current,
          } satisfies AnswerMessage);
        }
        return;
      }
      apply(message.payload, false);
    };
    channel.postMessage({ type: "hello" } satisfies AnswerMessage);
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [apply]);

  const value = useMemo<AnswerStore>(
    () => ({
      payload,
      setPayload: (next) => apply(next, true),
      clear: () => apply(null, true),
    }),
    [payload, apply],
  );

  return <AnswerContext value={value}>{children}</AnswerContext>;
}

export function useAnswer(): AnswerStore {
  const store = useContext(AnswerContext);
  if (!store) {
    throw new Error("useAnswer kan bare brukes inne i AnswerProvider.");
  }
  return store;
}
