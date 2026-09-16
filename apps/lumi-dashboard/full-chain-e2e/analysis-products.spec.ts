import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const DEMO_URL = process.env.LUMI_DEMO_URL ?? "http://127.0.0.1:3001";
const DASHBOARD_URL = process.env.LUMI_DASHBOARD_URL ?? "http://127.0.0.1:3000";

test("a registered widget source can be saved, previewed and locked as an analysis contract", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  for (const url of [DEMO_URL, DASHBOARD_URL]) {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(url).hostname);
  }
  const marker = `analysis-source-${Date.now()}`;
  const productName = `Analysekontrakt ${Date.now()}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(DEMO_URL);
  await page
    .getByRole("combobox", { name: "Survey- og feltvariant" })
    .selectOption("rating-stars");
  const widget = page.getByRole("complementary", {
    name: "Tilbakemeldingspanel",
  });
  await widget.getByRole("radio", { name: "4 av 5 stjerner. Bra" }).click();
  await widget
    .getByRole("textbox", { name: "Legg gjerne til en begrunnelse" })
    .fill(marker);
  const submitted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/azure/v1/feedback"),
  );
  await widget.getByRole("button", { name: "Send", exact: true }).click();
  const receipt = await submitted;
  expect(receipt.status(), await receipt.text()).toBe(201);
  expect(receipt.request().postDataJSON()).toMatchObject({
    schemaVersion: 2,
    surveyId: "local-demo-rating-stars",
    definition: { surveyType: "rating" },
  });

  await page.goto(
    `${DASHBOARD_URL}/analyseprodukter?team=local-dev&productId=new`,
  );
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill(productName);
  await page
    .getByLabel("Hva skal dere bruke dataene til?")
    .fill("Verifisere kontrakten fra en registrert survey til lagret release.");
  await page.getByLabel("Dataeier", { exact: true }).fill("Lokal dataeier");
  await page.getByLabel("Teknisk ansvarlig", { exact: true }).fill("local-dev");
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 30);
  await page.getByLabel("Dato for ny vurdering", { exact: true }).fill(
    new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(reviewDate),
  );
  await page.getByRole("checkbox", { name: "Metabase", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "local-demo-rating-stars", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "stars", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: "feedback", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Lokal demo:/)).toHaveCount(0);

  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  await expect(page).toHaveURL(/productId=[0-9a-f-]{36}/);
  const productUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).toBeVisible();
  await expect(
    page.getByText("Syntetiske eksempeldata", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Felt og tillatte verdier", exact: true })
    .click();
  await expect(page.getByText("Stjerner: 1–5", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Felt og tillatte verdier", exact: true })
    .click();
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const rows = page.getByRole("region", { name: /Eksempelrader, rull/ });
    await rows.scrollIntoViewIfNeeded();
    // Real compiler names must scroll, never collapse into one-letter lines.
    const layout = await rows.evaluate((element) => {
      const header = element.querySelector("th");
      if (!header) throw new Error("Preview is missing column headers");
      return {
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        headerHeight: header.getBoundingClientRect().height,
        headerWrapping: getComputedStyle(header).whiteSpace,
      };
    });
    expect(layout.contentWidth).toBeGreaterThan(layout.width);
    expect(layout.headerWrapping).toBe("nowrap");
    expect(layout.headerHeight).toBeLessThan(60);
    // Aksel's textarea measuring element settles after a viewport resize.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
    await rows.focus();
    await rows.press("ArrowRight");
    await expect
      .poll(() => rows.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await rows.press("ArrowLeft");
    await page.screenshot({
      path: testInfo.outputPath(`analysis-contract-${viewport.width}.png`),
    });
    await page.getByRole("tab", { name: /^Kolonner/ }).click();
    const columns = page.getByRole("tabpanel", { name: /^Kolonner/ });
    await expect(
      columns.getByText(/__rating$/, { exact: false }),
    ).toBeVisible();
    await expect(columns.getByText("Kan mangle (NULL)").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
    const accessibility = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.getByRole("tab", { name: "Eksempelrader" }).click();
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  const updatedName = `${productName} oppdatert`;
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill(updatedName);
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lås første release", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Navn", exact: true }),
  ).toHaveValue(updatedName);
  await expect(
    page.getByRole("checkbox", { name: "stars", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Lås første release", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Lås første release?",
  });
  await expect(
    confirmation.getByText(/Dette publiserer ikke data/),
  ).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Lås release", exact: true }),
  ).toBeDisabled();
  await confirmation
    .getByRole("checkbox", {
      name: "Jeg har kontrollert datagrunnlaget og de syntetiske tabellene.",
    })
    .check();
  await confirmation
    .getByRole("button", { name: "Lås release", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: updatedName, exact: true }),
  ).toBeVisible();
  await page.goto(productUrl);
  await expect(page.getByText("Release 1 låst", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: updatedName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("local-app / local-demo-rating-stars: stars", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lagre utkast", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Lokal demo:/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
