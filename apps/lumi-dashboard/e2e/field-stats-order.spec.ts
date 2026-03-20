import { expect, test } from "@playwright/test";

test.describe("Field stats ordering", () => {
  test("Statistikk per felt preserves question order for mixed field types", async ({
    page,
  }) => {
    await page.goto("/?surveyId=survey-ordering");

    // Wait for dashboard to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    const section = page.getByTestId("field-stats-section");
    await expect(
      section.getByRole("heading", { name: "Statistikk per felt" }),
    ).toBeVisible();

    // Prefer stable test ids over CSS class selectors.
    const fieldTitles = section.locator('[data-testid^="field-stat-title-"]');

    // Expect the dedicated mock survey to render fields in survey order,
    // even when question types are mixed.
    await expect(fieldTitles).toHaveCount(4);
    await expect(fieldTitles.nth(0)).toHaveText("Ordering Q1");
    await expect(fieldTitles.nth(1)).toHaveText("Ordering Q2");
    await expect(fieldTitles.nth(2)).toHaveText("Ordering Q3");
    await expect(fieldTitles.nth(3)).toHaveText("Ordering Q4");
  });
});
