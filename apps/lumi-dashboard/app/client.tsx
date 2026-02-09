import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

type RecoverableErrorInfo = {
  componentStack?: string;
};

const REACT_MINIFIED_ERROR_PATTERN = /Minified React error #(\d+)/;
const REACT_ERROR_HINTS: Record<string, string> = {
  "418":
    "Hydration mismatch: server-rendered HTML differs from the initial client render.",
};

const shouldLogHydrationDiagnostics =
  import.meta.env.DEV || import.meta.env.VITE_HYDRATION_DEBUG === "true";

function getReactMinifiedErrorCode(error: unknown): string | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  if (!message) {
    return null;
  }

  const match = message.match(REACT_MINIFIED_ERROR_PATTERN);
  return match?.[1] ?? null;
}

function logRecoverableHydrationError(
  error: unknown,
  errorInfo: RecoverableErrorInfo,
): void {
  const html = document.documentElement;
  const body = document.body;
  const nonceMeta = document
    .querySelector('meta[property="csp-nonce"]')
    ?.getAttribute("content");
  const scriptNonce = document
    .querySelector("head script[nonce]")
    ?.getAttribute("nonce");
  const reactErrorCode = getReactMinifiedErrorCode(error);
  const reactErrorHint = reactErrorCode
    ? (REACT_ERROR_HINTS[reactErrorCode] ?? null)
    : null;

  console.error("[hydration] Recoverable hydration error", {
    error,
    componentStack: errorInfo.componentStack,
    reactErrorCode,
    reactErrorHint,
    htmlClass: html.className,
    htmlDataTheme: html.getAttribute("data-theme"),
    htmlColorScheme: html.style.colorScheme,
    bodyDataTheme: body?.getAttribute("data-theme") ?? null,
    bodyColorScheme: body?.style.colorScheme ?? null,
    nonceMeta,
    scriptNonce,
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    shouldLogHydrationDiagnostics
      ? { onRecoverableError: logRecoverableHydrationError }
      : undefined,
  );
});
