import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // The browser tests in e2e/ are run by Playwright.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
