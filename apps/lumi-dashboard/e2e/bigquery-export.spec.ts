import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectAccessibleAtBothWidths(page: Page) {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("sets up, runs and stops a BigQuery export from the export page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/export?team=team-esyfo");
  await page.getByRole("link", { name: "Sett opp BigQuery-eksport" }).click();
  await expect(page).toHaveURL(/\/bigquery\?team=team-esyfo/);
  await expect(
    page.getByRole("heading", { name: "BigQuery og Metabase", level: 1 }),
  ).toBeVisible();

  const project = page.getByRole("textbox", { name: /GCP-prosjekt/ });
  await expect(project).toHaveValue("team-esyfo-dev-1a2b");
  await expect(page.getByLabel("SQL for å opprette datasettet")).toContainText(
    "labels = [('lumi-team', 'team-esyfo')]",
  );
  await expectAccessibleAtBothWidths(page);

  await page.getByRole("textbox", { name: /Datasett/ }).fill("mangler_tilgang");
  await page.getByRole("button", { name: "Sjekk tilkoblingen" }).click();
  await expect(
    page.getByText("Lumi har ikke tilgang til datasettet"),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /Datasett/ }).fill("lumi");
  await page.getByRole("button", { name: "Sjekk tilkoblingen" }).click();
  await expect(
    page.getByText("Alt er klart. Lumi kan lage tabeller i datasettet."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start eksporten" }).click();
  await expect(
    page.getByRole("heading", { name: "Neste steg", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Tabellene er oppdatert")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Aktiv", { exact: true })).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await page.reload();
  await expect(page.getByText("Tabellene er oppdatert")).toBeVisible();

  await page.getByRole("button", { name: "Stopp eksporten" }).click();
  const dialog = page.getByRole("dialog", { name: "Stopp BigQuery-eksporten" });
  await expect(
    dialog.getByRole("button", { name: "Stopp eksporten" }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", {
      name: "Ja, stopp eksporten og slett Lumis tabeller",
    })
    .check();
  await dialog.getByRole("button", { name: "Stopp eksporten" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Eksporten er stoppet, og Lumis tabeller er slettet."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start eksporten" }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("keeps teams outside the pilot out and explains why", async ({ page }) => {
  await page.goto("/bigquery?team=team-ny");
  await expect(
    page.getByRole("heading", { name: "BigQuery-eksport er i pilot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start eksporten" }),
  ).toHaveCount(0);
});
