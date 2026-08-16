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
});
