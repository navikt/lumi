import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectAccessibleAtBothWidths(page: Page) {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    // A click leaves the pointer on the button, and the hover colour of Aksel's
    // secondary button is just below 4.5:1. The check is about resting states.
    await page.mouse.move(0, 0);
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

test("sets up, changes, runs and stops a BigQuery export from the export page", async ({
  page,
}) => {
  // One flow through setup, a run, a settings change and a stop, with axe
  // at two widths along the way.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/export?team=team-esyfo");
  await page.getByRole("link", { name: "Gå til BigQuery-eksport" }).click();
  await expect(page).toHaveURL(/\/bigquery\?team=team-esyfo/);
  await expect(
    page.getByRole("heading", { name: "BigQuery-eksport", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sett opp eksporten", level: 2 }),
  ).toBeVisible();

  const project = page.getByRole("textbox", { name: /GCP-prosjekt/ });
  await expect(project).toHaveValue("team-esyfo-dev-1a2b");
  await expect(
    page.getByRole("figure", { name: "SQL for BigQuery" }),
  ).toContainText("labels = [('lumi-team', 'team-esyfo')]");
  await expect(
    page.getByRole("checkbox", { name: "Ta med fritekstsvar" }),
  ).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await page.getByRole("textbox", { name: /Datasett/ }).fill("mangler_tilgang");
  await page.getByRole("button", { name: "Sjekk tilkoblingen" }).click();
  await expect(
    page.getByText("Lumi har ikke tilgang til datasettet"),
  ).toBeVisible();
  // The problem comes with the SQL that fixes it.
  await expect(page.getByRole("button", { name: "Kopier SQL" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Vis SQL-en" })).toBeVisible();
  await expectAccessibleAtBothWidths(page);

  await page.getByRole("textbox", { name: /Datasett/ }).fill("lumi");
  await page.getByRole("button", { name: "Sjekk tilkoblingen" }).click();
  await expect(
    page.getByText("Datasettet er klart. Lumi kan lage tabeller i det."),
  ).toBeVisible();

  const freeText = page.getByRole("checkbox", { name: "Ta med fritekstsvar" });
  await freeText.check();
  await expect(
    page.getByText(
      "Tabellen fritekst skal ikke deles utenfor teamet. Sjekk at PVK-en og behandlingen i Behandlingskatalogen dekker fritekst.",
    ),
  ).toBeVisible();
  await freeText.uncheck();

  await page.getByRole("button", { name: "Start eksporten" }).click();
  await expect(page.getByText("Tabellene er oppdatert")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: "Neste steg", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Aktiv", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Åpne datasettet i BigQuery/ }),
  ).toHaveAttribute("target", "_blank");
  await expectAccessibleAtBothWidths(page);

  await page.reload();
  await expect(page.getByText("Tabellene er oppdatert")).toBeVisible();

  const settings = page.getByRole("region", {
    name: "Innstillinger for BigQuery-eksporten",
  });
  await settings.getByRole("button", { name: "Vis mer" }).click();
  await settings.getByRole("textbox", { name: /Datasett/ }).fill("lumi_ny");
  await expect(
    settings.getByText(
      /Når du lagrer, sletter Lumi tabellene i team-esyfo-dev-1a2b\.lumi\./,
    ),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Lagre endringer" }).click();
  await expect(
    settings.getByText(
      "Endringene er lagret. Lumi oppdaterer tabellene i løpet av noen minutter.",
    ),
  ).toBeVisible();
  // The previous run started a moment ago, so the new one waits its turn.
  await expect(
    page.getByRole("heading", {
      name: /^Kjøringen starter rundt kl\. \d{2}:\d{2}$/,
    }),
  ).toBeVisible();
  await expectAccessibleAtBothWidths(page);

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
  await expect(page.locator(":focus")).toContainText("Eksporten er stoppet");
  await expect(
    page.getByRole("button", { name: "Start eksporten" }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("explains that free text is closed for the team", async ({ page }) => {
  const closed = {
    team: "team-esyfo",
    available: true,
    availability: "AVAILABLE",
    location: "europe-north1",
    serviceAccount:
      "lumi-api-team-esyfo-1a2b3c4d@nais-dev-2e7b.iam.gserviceaccount.com",
    suggestedProjectId: "team-esyfo-dev-1a2b",
    freeTextAvailable: false,
    destination: null,
  };
  // The mock opens free text for team-esyfo, so replace only its status.
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.method() !== "GET" ||
      !["fetch", "xhr"].includes(request.resourceType())
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.text();
    if (!body.includes("freeTextAvailable")) {
      await route.fulfill({ response });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: closed, context: {} }),
    });
  });

  await page.goto("/bigquery?team=team-esyfo");
  await expect(
    page.getByText(/Fritekst kan ikke eksporteres for teamet ennå/),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Ta med fritekstsvar" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^#lumi/ })).toHaveAttribute(
    "href",
    "https://nav-it.slack.com/archives/C0AG2FKSSMD",
  );
  await expectAccessibleAtBothWidths(page);
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
