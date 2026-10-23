import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

/**
 * Flat-string search serializer/parser.
 *
 * TanStack Router defaults to JSON-first encoding via an internal `qss`
 * module that auto-converts numeric strings to numbers (e.g. "5" → 5)
 * and wraps parseable strings in quotes (e.g. page="1" → %221%22).
 *
 * Since every search param in this app is a plain string, we bypass qss
 * entirely and use standard URLSearchParams for predictable key=value
 * round-trips.
 */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export function parseSearch(searchStr: string): Record<string, string> {
  if (searchStr.startsWith("?")) {
    searchStr = searchStr.slice(1);
  }
  const params = new URLSearchParams(searchStr);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

// Server: the nonce the request middleware in app/start.ts put in the context.
// Browser: undefined. The router reads the nonce from
// <meta property="csp-nonce"> when it hydrates.
//
// Start also calls getRouter outside the request context, for example to
// resolve a redirect from a server function. getGlobalStartContext() throws
// there. That router renders no HTML, so it needs no nonce.
function getCspNonce(): string | undefined {
  try {
    return getGlobalStartContext()?.cspNonce;
  } catch {
    return undefined;
  }
}

export function getRouter() {
  const nonce = getCspNonce();

  return createRouter({
    routeTree,
    scrollRestoration: true,
    stringifySearch,
    parseSearch,
    ssr: nonce ? { nonce } : undefined,
  });
}
