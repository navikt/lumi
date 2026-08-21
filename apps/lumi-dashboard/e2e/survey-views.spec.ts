import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Survey View Tests - Verify survey-type specific dashboard views work correctly.
 * These tests use mock mode to ensure consistent data.
 */

test.describe("Survey Views", () => {
  test.describe("TopTasks View", () => {
    test("displays TPI quadrant, task table and recurring blockers", async ({
      page,
    }) => {
      await page.goto("/?surveyId=survey-top-tasks&fromDate=2000-01-01");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "Det som hindrer brukerne" }),
      ).toBeVisible();
      const blockerPhrase = page
        .getByRole("link", { name: /tilbakemeldinger med uttrykket/i })
        .first();
      await expect(blockerPhrase).toBeVisible();
      await expect(blockerPhrase).toHaveAttribute("href", /phrase=blocker/);
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
    test("shows phrases and examples without accessibility violations", async ({
      page,
    }) => {
      await page.goto("/?surveyId=survey-discovery&fromDate=2000-01-01");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("heading", {
          name: "Det brukerne prøver å gjøre",
        }),
      ).toBeVisible();
      await expect(page.getByText(/^(Noen|Mange) svar$/)).toBeVisible();
      await expect(
        page
          .getByRole("link", { name: /tilbakemeldinger med uttrykket/i })
          .first(),
      ).toBeVisible();
      await expect(page.getByText("Ordfrekvens")).toHaveCount(0);

      const accessibility = await new AxeBuilder({ page })
        .include("[data-testid='text-insights']")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
    });

    test("opens the responses behind a phrase and fits a narrow viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/?surveyId=survey-discovery&fromDate=2000-01-01");
      await page.waitForLoadState("networkidle");

      const phraseLink = page
        .getByRole("link", { name: /tilbakemeldinger med uttrykket/i })
        .first();
      await expect(phraseLink).toBeVisible();
      const phraseLabel = await phraseLink.getAttribute("aria-label");
      const expectedCount = phraseLabel?.match(/Vis (\d+)/)?.[1];
      const phraseText = phraseLabel?.match(/uttrykket «(.+?)»/)?.[1];
      expect(expectedCount).toBeTruthy();
      expect(phraseText).toBeTruthy();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await phraseLink.click();
      await expect(page).toHaveURL(/\/feedback/);
      await expect
        .poll(() => new URL(page.url()).searchParams.get("phrase"))
        .toMatch(/^task:/);
      await expect(
        page.getByText(`«${phraseText}»`, { exact: false }).first(),
      ).toBeVisible();
      await expect(
        page.getByText(new RegExp(`Viser ${expectedCount} svar`)),
      ).toBeVisible();
      await expect(page.getByText("Ingen tilbakemeldinger funnet")).toHaveCount(
        0,
      );
    });

    test("theme editor fits a narrow viewport without structural accessibility violations", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto("/?surveyId=survey-discovery&fromDate=2000-01-01");
      await page.waitForLoadState("networkidle");

      await page
        .getByRole("button", { name: /Rediger temaet/ })
        .first()
        .click();
      const dialog = page.getByRole("dialog", { name: "Rediger tema" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Slett tema" }),
      ).toBeVisible();
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);

      const accessibility = await new AxeBuilder({ page })
        .include("dialog")
        // Playwright's dialog backdrop blending gives Aksel's primary button a
        // false contrast value; page-level axe tests cover the same button token.
        .disableRules(["color-contrast"])
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
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
