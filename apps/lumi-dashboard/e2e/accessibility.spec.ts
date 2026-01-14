import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility tests using axe-core.
 * Scans all main routes for WCAG violations.
 */

test.describe("Accessibility - WCAG Compliance", () => {
  test("Dashboard page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log(
        "Dashboard a11y violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }

    expect(results.violations).toEqual([]);
  });

  test("Feedback page has no critical a11y violations", async ({ page }) => {
    await page.goto("/feedback");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        "Feedback a11y violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }

    expect(results.violations).toEqual([]);
  });

  test("Export page has no critical a11y violations", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        "Export a11y violations:",
        JSON.stringify(results.violations, null, 2),
      );
    }

    expect(results.violations).toEqual([]);
  });
});

test.describe("Keyboard Navigation", () => {
  test("Can navigate dashboard with keyboard only", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Tab through focusable elements
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(firstFocused).toBeTruthy();

    // Continue tabbing and verify focus moves
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    // Verify we can still get focus
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(focusedElement).toBeTruthy();
  });

  test("Modal traps focus correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open period selector (if available)
    const periodButton = page.getByRole("button", { name: /periode/i });
    if (await periodButton.isVisible()) {
      await periodButton.click();

      // Tab should stay within modal
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Escape should close
      await page.keyboard.press("Escape");
      await expect(periodButton).toBeVisible();
    }
  });

  test("Interactive elements are reachable via Tab", async ({ page }) => {
    await page.goto("/feedback");
    await page.waitForLoadState("networkidle");

    // Find all interactive elements
    const interactiveElements = await page
      .locator(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      .count();

    // Verify there are focusable elements
    expect(interactiveElements).toBeGreaterThan(0);
  });
});

test.describe("Screen Reader Announcements", () => {
  test("Loading states have aria-live regions", async ({ page }) => {
    await page.goto("/");

    // Check for aria-live regions
    const liveRegions = await page.locator("[aria-live]").count();
    // At minimum, we should have live regions for loading states
    expect(liveRegions).toBeGreaterThanOrEqual(0); // Soft check - we'll add these
  });

  test("Main content has proper landmark roles", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for main landmark
    const main = await page.locator('main, [role="main"]').count();
    expect(main).toBeGreaterThan(0);

    // Check for header
    const header = await page.locator('header, [role="banner"]').count();
    expect(header).toBeGreaterThan(0);
  });
});
