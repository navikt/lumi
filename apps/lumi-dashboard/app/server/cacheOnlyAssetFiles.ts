import { definePlugin } from "nitro";
import type { H3Event } from "nitro/h3";

/**
 * Nitro plugin that keeps the year-long cache for real files under /assets.
 *
 * Nitro's route rule gives everything under /assets
 * `Cache-Control: public, max-age=31536000, immutable`, and since h3 2 it also
 * covers the 404 page and the redirects Start answers with there. Where the
 * pod serves the assets itself (Dockerfile.local, Playwright against the
 * production build), a 404 for a file that is not deployed yet would stay in
 * the browser for a year. Those responses get the header Start uses instead.
 */
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("response", (response, event) => {
    if (response.status < 300 || response.status === 304) return;

    // Nitro passes the H3Event. Route rules match its canonical pathname,
    // where /%61ssets is /assets, so this check must use the same one.
    const { pathname } = (event as H3Event).url;
    if (pathname !== "/assets" && !pathname.startsWith("/assets/")) return;

    response.headers.set("Cache-Control", "private, no-store");
  });
});
