import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // @ts-expect-error: Known type mismatch between vite and vitest types
    tsconfigPaths({
      projects: ["./tsconfig.json"],
    }),
    // @ts-expect-error: Known type mismatch between vite and vitest types
    react(),
  ],
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
