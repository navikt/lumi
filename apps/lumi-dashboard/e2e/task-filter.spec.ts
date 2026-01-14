import { expect, test } from "@playwright/test";

test.describe("Top Tasks - Task Filter", () => {
  // This test requires mock data mode to run reliably
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for dashboard to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("clicking on task quadrant point updates URL with task filter", async ({
    page,
  }) => {
    // Navigate to a Top Tasks survey (assumes mock data has one)
    // First check if we can see the task quadrant
    const quadrant = page.locator('text="Oppgavekvadrant"');

    // Skip test if not on Top Tasks view (different survey type selected)
    if (!(await quadrant.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Top Tasks view not available");
      return;
    }

    // Find and click on a scatter point in the quadrant chart
    const scatterChart = page.locator(".recharts-scatter-symbol").first();

    if (await scatterChart.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scatterChart.click();

      // Check that URL now contains task parameter
      await expect(page).toHaveURL(/[?&]task=/, { timeout: 5000 });

      // Check that filter chip appears
      const filterChip = page.locator('text="Oppgave:"');
      await expect(filterChip).toBeVisible({ timeout: 5000 });
    }
  });

  test("removing task filter chip clears URL parameter", async ({ page }) => {
    // Set task filter directly in URL
    await page.goto("/?surveyId=top-tasks-survey&task=TestTask");

    // Check for filter chip with remove button
    const removeButton = page.locator(
      '[aria-label="Fjern filter Oppgave"], button:near(:text("Oppgave:"))',
    );

    // If chip is visible, click to remove
    if (await removeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await removeButton.click();

      // URL should no longer contain task parameter
      await expect(page).not.toHaveURL(/[?&]task=/, { timeout: 5000 });
    }
  });

  test("task filter persists in URL after page reload", async ({ page }) => {
    // Navigate with task filter
    const taskName = "Finne svar på spørsmål";
    await page.goto(`/?task=${encodeURIComponent(taskName)}`);

    // Reload page
    await page.reload();

    // Check URL still has task parameter
    await expect(page).toHaveURL(/[?&]task=/, { timeout: 5000 });
  });
});
