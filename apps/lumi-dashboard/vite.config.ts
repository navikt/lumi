import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Server-only packages and their subpaths. The client build leaves them out
// as long as only server code uses them: server functions, middleware,
// server routes and createServerOnlyFn. If client code imports one anyway,
// import protection below fails `vite build`; `vite dev` mocks it and warns.
const serverOnlyModules = [
  "@navikt/oasis",
  "@navikt/pino-logger",
  "pino",
  "@prometheus-io/client",
  "exceljs",
];
export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === "build" && mode === "production";
  const cdnBasePath = process.env.CDN_BASE_PATH || "/lumi-dashboard";
  const cdnBaseUrl =
    process.env.CDN_BASE_URL || `https://cdn.nav.no/team-esyfo${cdnBasePath}`;
  const base = isProductionBuild
    ? process.env.LUMI_DASHBOARD_ASSET_BASE_URL || `${cdnBaseUrl}/client/`
    : undefined;

  return {
    base,
    resolve: {
      // Each file gets the `paths` from its nearest tsconfig.json. For the
      // dashboard that is ./tsconfig.json: `~/*` and the workspace packages.
      tsconfigPaths: true,
    },
    build: {
      // Browser telemetry uses the release SHA to resolve these maps from NAV CDN.
      sourcemap: isProductionBuild,
    },
    server: {
      port: 3000,
      strictPort: true,
    },

    // Nitro configuration for deployment
    nitro: {
      preset: "node-server",
      // Nitro bundles node_modules for the server with Rolldown, which warns
      // about every "use client" directive. They mean nothing on the server.
      // The nitro alpha types require `output`; Nitro fills in the rest.
      rolldownConfig: {
        checks: { moduleLevelDirective: false },
        output: {},
      },
    },

    plugins: [
      tanstackStart({
        // Use app directory as source (non-standard but keeps our structure)
        srcDirectory: "app",
        // Fail the client build if client code still imports server-only code.
        // `files` replaces the defaults, so keep the `.server.*` convention.
        importProtection: {
          client: {
            specifiers: serverOnlyModules.flatMap((module) => [
              module,
              `${module}/**`,
            ]),
            files: ["**/*.server.*", "**/app/mock/**"],
          },
        },
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
