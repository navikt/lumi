import { expect, type Page, test } from "@playwright/test";

async function gotoSurveyCustom(page: Page, url = "/?surveyId=survey-custom") {
  await page.goto(url);
  await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("field-stats-section")).toBeVisible({
    timeout: 10000,
  });
}

test.describe("Field filters", () => {
  test("clicking a choice bar updates the URL with a choice filter", async ({
    page,
  }) => {
    await gotoSurveyCustom(page);

    await expect(page.getByTestId("field-stat-title-role")).toBeVisible();

    await page.getByRole("button", { name: /Arbeidsgiver/ }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("choice"))
      .toBe("role:Arbeidsgiver");
  });

  test("navigating with a choice filter shows a chip that can be removed", async ({
    page,
  }) => {
    await gotoSurveyCustom(
      page,
      "/?surveyId=survey-custom&choice=role%3AArbeidsgiver",
    );

    await expect(page.getByText("Rolle: Arbeidsgiver")).toBeVisible();

    await page
      .getByRole("button", {
        name: "Fjern filter Rolle: Arbeidsgiver",
      })
      .click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("choice"))
      .toBeNull();
  });

  test("navigating with a rating filter shows a rating chip", async ({
    page,
  }) => {
    await gotoSurveyCustom(
      page,
      "/?surveyId=survey-custom&rating=satisfaction%3A5",
    );

    await expect(page.getByText("Hvor fornøyd er du?: 5")).toBeVisible();
  });

  test("choice and rating filters can be active at the same time", async ({
    page,
  }) => {
    await page.goto(
      "/?surveyId=survey-custom&choice=role%3AArbeidsgiver&rating=satisfaction%3A5",
    );
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Both filter params should be present in the URL
    await expect
      .poll(() => new URL(page.url()).searchParams.get("choice"))
      .toBe("role:Arbeidsgiver");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("rating"))
      .toBe("satisfaction:5");

    // At least one filter chip should render (label may vary based on stats masking)
    await expect(
      page.getByRole("button", { name: /Fjern filter/ }),
    ).toBeVisible({ timeout: 10000 });
  });
});
