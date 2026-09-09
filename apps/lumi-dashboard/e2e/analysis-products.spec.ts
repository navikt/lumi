import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("selects, saves, reviews and locks an analysis contract without publishing data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/analyseprodukter?team=team-esyfo&productId=new");
  await expect(page.getByText(/Lokal demo:/)).toBeVisible();
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("E2E analyseprodukt");
  await page
    .getByLabel("Hva skal dere bruke dataene til?")
    .fill("Følge utviklingen i en avgrenset survey.");
  await page.getByLabel("Dataeier", { exact: true }).fill("Demo dataeier");
  await page.getByLabel("Teknisk ansvarlig", { exact: true }).fill("Demo team");
  const review = new Date();
  review.setDate(review.getDate() + 30);
  const reviewDate = new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(review);
  await page
    .getByLabel("Dato for ny vurdering", { exact: true })
    .fill(reviewDate);
  await page.getByRole("checkbox", { name: "Metabase", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "opplevelse-v2", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "kommentar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "vurdering", exact: true }).check();
  await page.getByRole("checkbox", { name: "rolle", exact: true }).check();
  await page.getByRole("checkbox", { name: "Enhetstype", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Ta med innsendt time", exact: true })
    .check();
  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  await expect(page).toHaveURL(/productId=[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "submitted_hour", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lagre utkast", exact: true }),
  ).toBeDisabled();

  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("E2E oppdatert analyseprodukt");
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lås første release", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).toBeVisible();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll("main *"))
        .filter(
          (element) =>
            element.getBoundingClientRect().right > window.innerWidth + 1 &&
            !element.closest("table"),
        )
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          width: element.getBoundingClientRect().width,
        })),
    }));
    // Aksel's autosizing textarea updates its measuring element after resize.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
        message: JSON.stringify(layout),
      })
      .toBeLessThanOrEqual(viewport.width);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page
    .getByRole("button", { name: "Lås første release", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Lås første release?" });
  await expect(dialog.getByText(/Dette publiserer ikke data/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Lås release", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", {
      name: "Jeg har kontrollert datagrunnlaget og de syntetiske tabellene.",
    })
    .check();
  await dialog
    .getByRole("button", { name: "Lås release", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "E2E oppdatert analyseprodukt" }),
  ).toBeVisible();
  await expect(page.getByText(/Lokal demo:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lagre utkast", exact: true }),
  ).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "E2E oppdatert analyseprodukt" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("does not silently fall back when the URL names an unavailable team", async ({
  page,
}) => {
  await page.goto("/analyseprodukter?team=another-team&productId=new");
  await expect(
    page.getByText(/Teamet i lenken er ikke tilgjengelig for deg/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Navn", exact: true }),
  ).not.toBeVisible();
});
