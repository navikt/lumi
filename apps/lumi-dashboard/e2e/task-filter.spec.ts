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
    // Set task filter directly in URL (survey-top-tasks is the mock survey ID)
    await page.goto("/?surveyId=survey-top-tasks&task=TestTask");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Wait for URL to stabilize — the period selector adds fromDate/toDate
    // defaults after initial render. Clicking before that finishes causes a
    // race where the default-navigation overwrites our removal.
    await expect
      .poll(() => new URL(page.url()).searchParams.has("fromDate"), {
        timeout: 5000,
      })
      .toBe(true);
    await page.waitForLoadState("networkidle");

    // Wait for the chip to render
    const chipText = page.getByText("Oppgave: TestTask");
    await expect(chipText).toBeVisible({ timeout: 5000 });

    // Click the remove button using getByRole for reliable interaction
    await page.getByRole("button", { name: /Fjern filter Oppgave/ }).click();

    // URL should no longer contain task parameter
    await expect
      .poll(() => new URL(page.url()).searchParams.get("task"), {
        timeout: 5000,
      })
      .toBeNull();
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
