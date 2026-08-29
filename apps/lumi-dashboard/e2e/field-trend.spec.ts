import { expect, test } from "@playwright/test";

test.describe("Field trend", () => {
  test("follows the selected question, period bucket and measure in the URL", async ({
    page,
  }) => {
    await page.goto("/?surveyId=survey-custom&trendFieldId=field.with.path");

    const trend = page.getByRole("region", {
      name: "Utvikling per spørsmål",
    });
    await expect(trend).toBeVisible({ timeout: 15000 });

    const question = trend.getByRole("combobox", { name: "Spørsmål" });
    await expect(question).toHaveValue("role");
    await expect(page).toHaveURL(/trendFieldId=role/);
    await expect(page).toHaveURL(/trendGranularity=week/);
    await expect(page).toHaveURL(/trendMeasure=percentage/);

    await question.selectOption("features");
    await trend.getByRole("radio", { name: "Måned" }).click();
    await trend.getByRole("radio", { name: "Antall" }).click();

    await expect(page).toHaveURL(/trendFieldId=features/);
    await expect(page).toHaveURL(/trendGranularity=month/);
    await expect(page).toHaveURL(/trendMeasure=count/);

    await trend.locator("summary").click();
    const table = trend.getByRole("table");
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Periode" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Innsending" }),
    ).toBeVisible();
  });

  test("fits a narrow viewport without horizontal page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/?surveyId=survey-custom&trendFieldId=features&trendGranularity=month&trendMeasure=percentage",
    );

    const trend = page.getByRole("region", {
      name: "Utvikling per spørsmål",
    });
    await expect(trend).toBeVisible({ timeout: 15000 });
    await expect(
      trend.getByText(/summen være høyere enn 100 prosent/),
    ).toBeVisible();

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });

  test("keeps the definition-backed empty state when active filters have no matches", async ({
    page,
  }) => {
    await page.goto("/?surveyId=survey-custom&segment=variant%3Ano-matches");

    const trend = page.getByRole("region", {
      name: "Utvikling per spørsmål",
    });
    await expect(trend).toBeVisible({ timeout: 15000 });
    await expect(
      trend.getByText("Ingen svar på dette spørsmålet i den valgte perioden."),
    ).toBeVisible();
  });
});
