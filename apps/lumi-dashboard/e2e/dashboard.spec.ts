import { expect, test } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads dashboard page", async ({ page }) => {
    await page.goto("/");

    // Basic check that page loads
    await expect(page).toHaveTitle(/Lumi Dashboard|Dashboard/i);
  });

  test("displays main content", async ({ page }) => {
    await page.goto("/");

    // Check for main element
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Feedback", () => {
  test("loads feedback page", async ({ page }) => {
    await page.goto("/feedback");

    // Check URL
    await expect(page).toHaveURL(/\/feedback/);
  });
});
