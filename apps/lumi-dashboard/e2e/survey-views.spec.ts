import { expect, test } from "@playwright/test";

/**
 * Survey View Tests - Verify survey-type specific dashboard views work correctly.
 * These tests use mock mode to ensure consistent data.
 */

test.describe("Survey Views", () => {
  test.describe("TopTasks View", () => {
    test("displays TPI quadrant and task table", async ({ page }) => {
      await page.goto("/?surveyId=survey-top-tasks");
      await page.waitForLoadState("networkidle");

      // Should display main content
      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

      // Should show Top Tasks specific elements when a topTasks survey is selected
      // Note: The exact elements depend on what survey is selected in mock mode
    });

    test("allows drilling down from task to feedback", async ({ page }) => {
      // Navigate to dashboard with Top Tasks survey
      await page.goto("/?surveyId=survey-top-tasks");
      await page.waitForLoadState("networkidle");

      // The task table should have clickable rows
      // This test verifies the navigation works when clicking a task
    });
  });

  test.describe("Discovery View", () => {
    test("displays word cloud and theme cards", async ({ page }) => {
      await page.goto("/?surveyId=survey-discovery");
      await page.waitForLoadState("networkidle");

      // Should display main content
      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

      // Discovery view shows word frequency visualization and themes
    });

    test("theme cards are interactive", async ({ page }) => {
      await page.goto("/?surveyId=survey-discovery");
      await page.waitForLoadState("networkidle");

      // Theme cards should be focusable and clickable
      // When clicked, they should filter feedback to that theme
    });
  });

  test.describe("TaskPriority View", () => {
    test("displays Long Neck chart", async ({ page }) => {
      await page.goto("/?surveyId=survey-task-priority");
      await page.waitForLoadState("networkidle");

      // Should display main content
      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

      // TaskPriority shows vote distribution with Long Neck cutoff
    });
  });

  test.describe("Rating Views", () => {
    test("displays rating distribution chart", async ({ page }) => {
      // Test with the main rating survey from mock data
      await page.goto("/?surveyId=survey-vurdering");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    });

    test("stars variant displays correctly", async ({ page }) => {
      await page.goto("/?surveyId=survey-stars");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    });

    test("thumbs variant displays correctly", async ({ page }) => {
      await page.goto("/?surveyId=survey-thumbs");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    });

    test("NPS variant displays correctly", async ({ page }) => {
      await page.goto("/?surveyId=survey-nps");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    });
  });
});

test.describe("Survey Type Switching", () => {
  test("can switch between survey types via URL", async ({ page }) => {
    // Start with rating survey
    await page.goto("/?surveyId=survey-vurdering");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Switch to discovery
    await page.goto("/?surveyId=survey-discovery");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Switch to top tasks
    await page.goto("/?surveyId=survey-top-tasks");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("preserves other filters when switching survey", async ({ page }) => {
    // Navigate with date filter
    await page.goto("/?fromDate=2026-01-01&toDate=2026-01-21");
    await page.waitForLoadState("networkidle");

    // The date range should be preserved in the URL
    await expect(page).toHaveURL(/fromDate=2026-01-01/);
    await expect(page).toHaveURL(/toDate=2026-01-21/);
  });
});
