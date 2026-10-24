import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: [
      // tsconfig.json points @navikt/lumi-survey at the widget source, which
      // the app build uses. The tests have always loaded the built package.
      {
        find: /^@navikt\/lumi-survey$/,
        replacement: fileURLToPath(
          new URL("../../packages/lumi-survey/dist/index.js", import.meta.url),
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.{ts,tsx}",
        "app/routeTree.gen.ts",
        "app/**/*.d.ts",
      ],
    },
  },
});
