import { useEffect } from "react";
import type { FlexJarStatus } from "../../../core/types.js";

interface AutoCloseOptions {
  enabled: boolean;
  status: FlexJarStatus;
  delayMs: number;
  onClose: () => void;
}

export const useAutoCloseOnSuccess = ({
  enabled,
  status,
  delayMs,
  onClose,
}: AutoCloseOptions): void => {
  useEffect(() => {
    if (!enabled || status !== "success") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      onClose();
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, enabled, onClose, status]);
};
