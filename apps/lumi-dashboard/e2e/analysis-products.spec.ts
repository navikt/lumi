import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  longFieldId,
  longSurveyId,
  useLargeAnalysisCatalog,
} from "./analysis-catalog.fixture";

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

test("keeps selected sources usable in a large catalog on desktop and mobile", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const replacedCatalog = await useLargeAnalysisCatalog(page);
  await page.goto("/analyseprodukter?team=team-esyfo&productId=new");
  const search = page.getByRole("textbox", {
    name: "Søk etter app eller survey",
  });
  await expect(search).toBeVisible();
  expect(replacedCatalog()).toBe(true);
  await expect(
    page.getByRole("checkbox", { name: /^oppfolging-/ }),
  ).toHaveCount(24);

  await search.fill("ingen-slik-survey");
  await expect(
    page.getByText("Ingen surveys samsvarer med søket.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /^oppfolging-/ }),
  ).toHaveCount(0);

  await search.fill("oppfolging-app-3");
  await expect(
    page.getByRole("checkbox", { name: /^oppfolging-/ }),
  ).toHaveCount(6);
  const longSource = page.getByRole("checkbox", {
    name: longSurveyId,
    exact: true,
  });
  await longSource.check();
  const fields = page.getByRole("group", {
    name: `Svarfelt i ${longSurveyId}`,
    exact: true,
  });
  await expect(fields.getByRole("checkbox")).toHaveCount(12);
  await fields
    .getByRole("checkbox", { name: longFieldId, exact: true })
    .check();

  await search.fill("opplevelse-v2");
  await expect(longSource).toBeChecked();
  await expect(
    fields.getByRole("checkbox", { name: longFieldId, exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText(
      "Valgte surveys vises også, slik at du kan endre utvalget.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "opplevelse-v2", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "vurdering", exact: true }).check();

  await search.fill("ingen-slik-survey");
  await expect(
    page.getByText("Ingen surveys samsvarer med søket.", { exact: true }),
  ).toBeVisible();
  await expect(longSource).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "opplevelse-v2", exact: true }),
  ).toBeChecked();
  await search.fill("opplevelse-v2");

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width);
    await expect(longSource).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await search.scrollIntoViewIfNeeded();
    const screenshot = testInfo.outputPath(
      `large-catalog-${viewport.width}.png`,
    );
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`Large catalog ${viewport.width}px`, {
      path: screenshot,
      contentType: "image/png",
    });
    if (viewport.width === 390) {
      await fields
        .getByRole("checkbox", { name: longFieldId, exact: true })
        .scrollIntoViewIfNeeded();
      const longFieldsScreenshot = testInfo.outputPath(
        "large-catalog-390-long-fields.png",
      );
      await page.screenshot({ path: longFieldsScreenshot });
      await testInfo.attach("Long selected field identifiers on mobile", {
        path: longFieldsScreenshot,
        contentType: "image/png",
      });
    }
  }

  // Deselecting a nonmatching source removes it immediately from the list.
  await longSource.click();
  await expect(longSource).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Navn", exact: true })
    .fill("E2E stort kildeutvalg");
  await page
    .getByLabel("Hva skal dere bruke dataene til?")
    .fill("Teste valg i en stor kildekatalog.");
  await page.getByLabel("Dataeier", { exact: true }).fill("Demo dataeier");
  await page.getByLabel("Teknisk ansvarlig", { exact: true }).fill("Demo team");
  const review = new Date();
  review.setDate(review.getDate() + 30);
  await page.getByLabel("Dato for ny vurdering", { exact: true }).fill(
    new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(review),
  );
  await page.getByRole("checkbox", { name: "Metabase", exact: true }).check();
  await page.getByRole("button", { name: "Lagre utkast", exact: true }).click();
  await expect(page).toHaveURL(/productId=[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { name: "Kontroller tabellene" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "demo_vurdering", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kolonner (3)", exact: true }).click();
  await expect(
    page.getByText("Kan mangle (NULL)", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});
