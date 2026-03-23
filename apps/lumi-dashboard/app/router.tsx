import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Flat-string search serializer.
 *
 * TanStack Router defaults to JSON-first encoding which wraps parseable
 * strings in quotes (e.g. page="1" → %221%22). Since every search param in
 * this app is a plain string, we use a simple key=value format instead.
 */
const stringifySearch = stringifySearchWith((value) => String(value));
const parseSearch = parseSearchWith((value) => value);

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
