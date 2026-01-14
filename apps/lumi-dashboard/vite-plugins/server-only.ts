import type { Plugin } from "vite";

/**
 * Vite plugin to replace server-only modules with empty stubs in client builds.
 * This prevents bare module specifiers from appearing in browser code.
 *
 * Only applies in production builds - dev mode handles this differently.
 */
export function serverOnlyPlugin(modules: string[]): Plugin {
  return {
    name: "server-only-stub",
    enforce: "pre",
    apply: "build", // Only apply during build, not serve (dev)
    resolveId(id, _importer, options) {
      // Only stub in client builds, not in SSR
      if (options?.ssr) return null;

      // Check if this is a server-only module
      if (modules.some((mod) => id === mod || id.startsWith(`${mod}/`))) {
        return "\0server-only-stub";
      }
      return null;
    },
    load(id) {
      if (id === "\0server-only-stub") {
        // Return empty module exports for client-side
        // Must include all exports that may be imported by server code that gets processed
        return `
          export default {};
          // @navikt/oasis stubs
          export const getToken = () => null;
          export const validateAzureToken = async () => ({ ok: false });
          export const requestAzureOboToken = async () => ({ ok: false, token: null });
          // prom-client stubs
          export const register = { metrics: async () => '', contentType: 'text/plain' };
          export const collectDefaultMetrics = () => {};
          // @navikt/pino-logger stubs
          const noop = () => {};
          export const logger = {
            info: noop,
            warn: noop,
            error: noop,
            debug: noop,
            trace: noop,
            fatal: noop,
            child: () => logger,
          };
        `;
      }
      return null;
    },
  };
}
