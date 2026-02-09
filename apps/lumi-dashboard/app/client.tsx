import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

type RecoverableErrorInfo = {
  componentStack?: string;
};

type ManifestAsset = {
  tag?: string;
  attrs?: Record<string, unknown>;
};

type ManifestRoute = {
  assets?: Array<ManifestAsset>;
};

type ManifestLike = {
  routes?: Record<string, ManifestRoute>;
};

const REACT_MINIFIED_ERROR_PATTERN = /Minified React error #(\d+)/;
const REACT_ERROR_HINTS: Record<string, string> = {
  "418":
    "Hydration mismatch: server-rendered HTML differs from the initial client render.",
};

const shouldLogHydrationDiagnostics =
  import.meta.env.DEV || import.meta.env.VITE_HYDRATION_DEBUG === "true";

function normalizeAssetPathFromUrl(urlLike: string): string | null {
  try {
    const parsed = new URL(urlLike, window.location.origin);
    const pathname = parsed.pathname;
    const clientSegment = "/client/";
    const clientIndex = pathname.indexOf(clientSegment);
    if (clientIndex >= 0) {
      const relative = pathname.slice(clientIndex + clientSegment.length);
      if (relative.length > 0) {
        return `/${relative}`;
      }
    }
    return pathname;
  } catch {
    return null;
  }
}

function syncManifestIntegrityFromRenderedDom(): void {
  if (typeof window === "undefined") {
    return;
  }

  const manifest = (
    window as Window & {
      $_TSR?: { router?: { manifest?: ManifestLike } };
    }
  ).$_TSR?.router?.manifest;
  if (!manifest?.routes) {
    return;
  }

  const integrityByPath = new Map<
    string,
    { integrity: string; crossorigin: string | null }
  >();

  const nodes = document.head.querySelectorAll(
    "link[href][integrity],script[src][integrity]",
  );
  for (const node of nodes) {
    const urlLike = node.getAttribute("href") ?? node.getAttribute("src");
    if (!urlLike) {
      continue;
    }
    const normalized = normalizeAssetPathFromUrl(urlLike);
    const integrity = node.getAttribute("integrity");
    if (!normalized || !integrity) {
      continue;
    }

    integrityByPath.set(normalized, {
      integrity,
      crossorigin: node.getAttribute("crossorigin"),
    });
  }

  if (integrityByPath.size === 0) {
    return;
  }

  for (const route of Object.values(manifest.routes)) {
    for (const asset of route.assets ?? []) {
      if (!asset || typeof asset !== "object") {
        continue;
      }

      const attrs = { ...(asset.attrs ?? {}) };
      const rawUrl = attrs.href ?? attrs.src;
      if (typeof rawUrl !== "string" || rawUrl.length === 0) {
        continue;
      }

      const normalized = normalizeAssetPathFromUrl(rawUrl);
      if (!normalized) {
        continue;
      }

      const matchingIntegrity = integrityByPath.get(normalized);
      if (!matchingIntegrity) {
        continue;
      }

      attrs.integrity = matchingIntegrity.integrity;
      attrs.crossorigin = matchingIntegrity.crossorigin ?? "anonymous";
      asset.attrs = attrs;
    }
  }
}

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

function logGlobalHydrationError(error: unknown): void {
  const reactErrorCode = getReactMinifiedErrorCode(error);
  if (reactErrorCode !== "418") {
    return;
  }

  const html = document.documentElement;
  const body = document.body;
  const nonceMeta = document
    .querySelector('meta[property="csp-nonce"]')
    ?.getAttribute("content");
  const scriptNonceAttr = document
    .querySelector("head script[nonce]")
    ?.getAttribute("nonce");

  console.error("[hydration] Global React hydration error", {
    error,
    reactErrorCode,
    reactErrorHint: REACT_ERROR_HINTS[reactErrorCode] ?? null,
    htmlClass: html.className,
    htmlDataTheme: html.getAttribute("data-theme"),
    htmlColorScheme: html.style.colorScheme,
    bodyDataTheme: body?.getAttribute("data-theme") ?? null,
    bodyColorScheme: body?.style.colorScheme ?? null,
    nonceMeta,
    scriptNonceAttr,
  });
}

if (shouldLogHydrationDiagnostics && typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    logGlobalHydrationError(event.error ?? event.message);
  });
}

syncManifestIntegrityFromRenderedDom();

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
