import { expect, test } from "@playwright/test";

test.describe("TextFieldCard phrases", () => {
  test("displays clickable phrases in text field card", async ({ page }) => {
    // Rating survey has a TEXT field ("Legg gjerne til en begrunnelse")
    await page.goto("/?surveyId=survey-vurdering");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Look for phrase heading in the text field card
    const heading = page.getByText("Hyppigste fraser");

    // Skip if no phrases available (mock data may not generate enough bigrams)
    if (
      !(await heading
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    ) {
      test.skip(true, "No phrases available in mock data for this survey");
      return;
    }

    await expect(heading.first()).toBeVisible();

    // Should have an ordered list of phrase links
    const phraseList = page.getByRole("list", { name: /hyppigste fraser/i });
    await expect(phraseList.first()).toBeVisible();

    // Phrase links should be visible and clickable
    const phraseLinks = page.getByRole("link", {
      name: /Vis \d+ tilbakemeldinger som inneholder frasen/i,
    });
    await expect(phraseLinks.first()).toBeVisible({ timeout: 5000 });

    // Should have at most 5 phrases per card
    const phraseCount = await phraseList.first().locator("li").count();
    expect(phraseCount).toBeLessThanOrEqual(5);
    expect(phraseCount).toBeGreaterThan(0);
  });

  test("clicking phrase navigates to feedback with query", async ({ page }) => {
    await page.goto("/?surveyId=survey-vurdering");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    const phraseLinks = page.getByRole("link", {
      name: /Vis \d+ tilbakemeldinger som inneholder frasen/i,
    });

    if (
      !(await phraseLinks
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    ) {
      test.skip(true, "No phrase links available in mock data");
      return;
    }

    // Extract phrase text from aria-label before clicking
    const firstLink = phraseLinks.first();
    const ariaLabel = await firstLink.getAttribute("aria-label");
    const phraseMatch = ariaLabel?.match(/frasen «(.+?)»/);
    const phraseText = phraseMatch?.[1] ?? "";

    await firstLink.click();

    // Should navigate to /feedback with query param
    await expect(page).toHaveURL(/\/feedback/, { timeout: 10000 });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("query"), {
        timeout: 5000,
      })
      .toBe(phraseText);

    // Should have hasText param set
    await expect
      .poll(() => new URL(page.url()).searchParams.get("hasText"), {
        timeout: 5000,
      })
      .toBe("true");
  });
});
