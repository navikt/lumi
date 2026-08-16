import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("creates, saves, reopens and previews a survey draft", async ({
  page,
}) => {
  await page.goto("/surveyverksted");

  await page.getByLabel("Navn på utkastet").fill("E2E surveyutkast");
  await page.getByLabel("Foreslått survey-ID").fill("e2e-survey-v1");
  await page.getByRole("button", { name: "Opprett utkast" }).click();

  await expect(page).toHaveURL(/\/surveyverksted\/[0-9a-f-]+\?team=team-esyfo/);
  await expect(
    page.getByRole("heading", { name: "E2E surveyutkast" }),
  ).toBeVisible();

  const pageTitle = page.getByLabel("Sidetittel");
  await pageTitle.fill("Detaljer om opplevelsen");
  await expect(page.getByText("Lagret · v2")).toBeVisible();

  await page.reload();
  await expect(pageTitle).toHaveValue("Detaljer om opplevelsen");

  await page.getByRole("button", { name: "Ny side" }).click();
  await expect(
    page.getByRole("button", { name: /02 Ny side 1 spørsmål/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Åpne forhåndsvisning" }),
  ).toBeDisabled();
  await expect(page.getByText("2", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Lagret · v3")).toBeVisible();

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Åpne forhåndsvisning" }).click();
  const preview = await previewPromise;

  await expect(
    preview.getByText("Svar sendes ikke eller lagres."),
  ).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).toBeVisible();
  const progress = preview.getByRole("progressbar", {
    name: "Fremdrift i undersøkelsen",
  });
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuetext", "Steg 1 av 2");
  await preview.close();

  await page.getByRole("button", { name: "Opprett delbar revisjon" }).click();
  await expect(page).toHaveURL(
    /\/surveyverksted\/revisions\/[0-9a-f-]+\?team=team-esyfo/,
  );
  await expect(page.getByText("Frosset revisjon")).toBeVisible();
  await expect(
    page.getByText("Gyldig SurveyDocumentV1", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Første delbare revisjon i prosjektet."),
  ).toBeVisible();
  await expect(page.getByText("documentHash")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kopier TypeScript" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Last ned JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-survey-v1-revision-1.json");

  await page.getByRole("button", { name: "Start preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Avslutt preview" }).click();
  await expect(
    page.getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).not.toBeVisible();
});
