import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("question trend can be configured, shared and restored", async ({
  page,
}) => {
  await page.goto("/?surveyId=survey-ordering");

  const section = page.getByTestId("question-trend-section");
  await expect(
    section.getByRole("heading", { name: "Utvikling over tid" }),
  ).toBeVisible({ timeout: 15000 });

  const question = section.getByRole("combobox", { name: "Spørsmål" });
  await expect(
    question.getByRole("option", { name: "Ordering Q3" }),
  ).toHaveCount(0);
  await question.selectOption("single-choice");

  await expect(page).toHaveURL(/trendField=single-choice/);
  await expect(page).toHaveURL(/trendInterval=week/);
  await expect(page).toHaveURL(/trendMeasure=percentage/);
  await expect(section.getByRole("table")).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="question-trend-section"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await section.getByText("Måned", { exact: true }).click();
  await section.getByText("Antall", { exact: true }).click();
  await expect(page).toHaveURL(/trendInterval=month/);
  await expect(page).toHaveURL(/trendMeasure=count/);

  await page.reload();
  await expect(question).toHaveValue("single-choice");
  await expect(section.getByRole("table")).toBeVisible();
});
