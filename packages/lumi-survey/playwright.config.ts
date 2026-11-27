import { defineConfig, devices } from "@playwright/test";

const PORT = 6116;

/**
 * Browser tests for what the unit tests cannot see. They run in jsdom, which
 * has no layout and does not scroll, so the width the survey takes and when
 * it counts as seen are measured in Chromium against Storybook.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec storybook dev --port ${PORT} --exact-port --ci --no-open`,
    url: `http://localhost:${PORT}/iframe.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
