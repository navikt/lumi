import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

type RecoverableErrorInfo = {
  componentStack?: string;
};

const shouldLogHydrationDiagnostics =
  import.meta.env.DEV || import.meta.env.VITE_HYDRATION_DEBUG === "true";

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

  console.error("[hydration] Recoverable hydration error", {
    error,
    componentStack: errorInfo.componentStack,
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
