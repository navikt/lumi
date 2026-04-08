import { defineConfig, devices } from "@playwright/test";

const DEFAULT_E2E_PORT = 3100;
const E2E_PORT = (() => {
  const raw = process.env.PLAYWRIGHT_PORT ?? process.env.E2E_PORT;
  if (!raw) return DEFAULT_E2E_PORT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_E2E_PORT;
})();

/**
 * Playwright E2E test configuration.
 * Tests run against the local dev server with mock data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Force the expected port so Playwright doesn't probe the wrong server if 3000 is taken.
    command: `pnpm run dev -- --port ${E2E_PORT} --strictPort`,
    // Avoid depending on SSR route readiness: Vite always serves this when the dev server is up.
    url: `http://localhost:${E2E_PORT}/@vite/client`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      USE_MOCK_DATA: "true",
    },
  },
});
