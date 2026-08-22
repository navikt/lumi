import { useEffect, useRef } from "react";
import type { LumiSurveyStatus } from "../../../core/types.js";

interface AutoCloseOptions {
  enabled: boolean;
  status: LumiSurveyStatus;
  delayMs: number;
  onClose: () => void;
}

export const useAutoCloseOnSuccess = ({
  enabled,
  status,
  delayMs,
  onClose,
}: AutoCloseOptions): void => {
  // Keep the deadline tied to survey state, while invoking the latest callback.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled || status !== "success") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      onCloseRef.current();
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, enabled, status]);
};
