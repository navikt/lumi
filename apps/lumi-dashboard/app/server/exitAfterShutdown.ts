import { definePlugin } from "nitro";

/**
 * Nitro plugin that ends the process once the server has shut down.
 *
 * On SIGTERM, srvx stops taking new connections and waits for requests in
 * flight. Since srvx 1 it no longer exits afterwards, but waits for the event
 * loop to empty. Server rendering leaves timers behind (for example TanStack
 * Query's gcTime), so the pod would otherwise run until Nais kills it.
 *
 * Nitro runs close hooks in plugin order, so keep this plugin last.
 */
export default definePlugin((nitroApp) => {
  // The Vite dev server runs Nitro in a worker it restarts on changes, so only
  // the production build exits. Nitro replaces NODE_ENV when it bundles.
  if (process.env.NODE_ENV !== "production") return;

  nitroApp.hooks.hook("close", () => {
    process.exit(0);
  });
});
