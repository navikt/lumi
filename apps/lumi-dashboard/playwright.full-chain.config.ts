import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./full-chain-e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/full-chain/playwright-report.json" }],
  ],
  outputDir: "test-results/full-chain/artifacts",
  timeout: 60_000,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
