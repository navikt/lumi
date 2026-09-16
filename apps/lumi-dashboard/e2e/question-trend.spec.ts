import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("question trend can be configured, shared and restored", async ({
  page,
}) => {
  await page.goto("/?surveyId=survey-ordering");

  await expect(
    page.getByRole("heading", { name: "Statistikk per felt" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Se utvikling for Ordering Q1" })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Utvikling: Ordering Q1");
  const section = dialog.getByTestId("question-trend-section");

  const question = section.getByRole("combobox", { name: "Spørsmål" });
  await expect(
    question.getByRole("option", { name: "Ordering Q3" }),
  ).toHaveCount(0);
  await question.selectOption("single-choice");
  await expect(dialog).toHaveAccessibleName("Utvikling: Ordering Q2");

  await expect(page).toHaveURL(/trendField=single-choice/);
  await expect(page).toHaveURL(/trendInterval=week/);
  await expect(page).toHaveURL(/trendMeasure=percentage/);
  await expect(section.getByRole("table")).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await section.getByText("Måned", { exact: true }).click();
  await section.getByText("Antall", { exact: true }).click();
  await expect(page).toHaveURL(/trendInterval=month/);
  await expect(page).toHaveURL(/trendMeasure=count/);

  await page.reload();
  await expect(dialog).toHaveAccessibleName("Utvikling: Ordering Q2");
  await expect(question).toHaveValue("single-choice");
  await expect(
    section.getByRole("radio", { name: "Måned", exact: true }),
  ).toBeChecked();
  await expect(
    section.getByRole("radio", { name: "Antall", exact: true }),
  ).toBeChecked();
  await expect(section.getByRole("table")).toBeVisible();

  const sharedUrl = page.url();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  for (const param of ["trendField", "trendInterval", "trendMeasure"]) {
    await expect
      .poll(() => new URL(page.url()).searchParams.has(param))
      .toBe(false);
  }

  await page.goto(sharedUrl);
  await expect(dialog).toHaveAccessibleName("Utvikling: Ordering Q2");
  await expect(question).toHaveValue("single-choice");
  await expect(section.getByRole("table")).toBeVisible();
});
