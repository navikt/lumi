import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
    ssr: nonce ? { nonce } : undefined,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
