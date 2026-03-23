import { createRouter } from "@tanstack/react-router";
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
function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

function parseSearch(searchStr: string): Record<string, string> {
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

export async function getRouter() {
  let nonce: string | undefined;

  if (import.meta.env.SSR) {
    const { getStartContext } = await import("@tanstack/start-storage-context");
    const startContext = getStartContext({ throwIfNotFound: false });
    nonce = startContext?.contextAfterGlobalMiddlewares?.cspNonce;
  }

  return createRouter({
    routeTree,
    scrollRestoration: true,
    stringifySearch,
    parseSearch,
    ssr: nonce ? { nonce } : undefined,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
