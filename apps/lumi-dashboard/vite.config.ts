import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { serverOnlyPlugin } from "./vite-plugins/server-only";

// Server-only modules that should be stubbed in client builds
// and externalized from SSR bundle to avoid CJS/ESM issues
const serverOnlyModules = [
  "@navikt/oasis",
  "@navikt/pino-logger",
  "pino",
  "prom-client",
];
export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === "build" && mode === "production";
  const cdnBasePath = process.env.CDN_BASE_PATH || "/lumi-dashboard";
  const cdnBaseUrl =
    process.env.CDN_BASE_URL || `https://cdn.nav.no/team-esyfo${cdnBasePath}`;
  const base = isProductionBuild ? `${cdnBaseUrl}/client/` : undefined;

  return {
    base,
    server: {
      port: 3000,
      strictPort: true,
    },

    // Externalize server-only dependencies from SSR bundle
    ssr: {
      external: serverOnlyModules,
    },

    // Nitro configuration for deployment
    nitro: {
      preset: "node-server",
    },

    plugins: [
      // Custom plugin to stub server-only modules in client builds
      serverOnlyPlugin(serverOnlyModules),
      tsconfigPaths({
        projects: ["./tsconfig.typecheck.json"],
      }),
      tanstackStart({
        // Use app directory as source (non-standard but keeps our structure)
        srcDirectory: "app",
        router: {
          // Prevent route generation from scanning test files/folders under app/routes
          routeFileIgnorePattern:
            "(^__tests__$|\\.(test|spec)\\.(ts|tsx|js|jsx)$)",
        },
      }),
      // Nitro handles production server deployment
      nitro(),
      // React plugin must come after TanStack Start plugin
      viteReact(),
    ],
  };
});
