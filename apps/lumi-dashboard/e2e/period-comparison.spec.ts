import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const period = "dateMode=fixed&fromDate=2026-08-19&toDate=2026-09-01";

test("rolling and year-to-date presets both compare the preceding period", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-01-08T12:00:00Z"));
  await page.goto(`/?${period}&surveyId=survey-vurdering`);
  const comparison = page.getByRole("checkbox", {
    name: "Sammenlign med forrige periode",
  });
  const periodButton = page.getByRole("button", { name: /^Periode:/ });
  await periodButton.click();
  await page.getByRole("button", { name: "Siste 7 hele dager" }).click();
  await expect(comparison).toBeChecked();
  await expect(
    page
      .getByText("Mot 25. des. 2025–31. des. 2025", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await periodButton.click();
  await page
    .getByRole("button", { name: "Hittil i år (t.o.m. i går)", exact: true })
    .click();
  await expect(comparison).toBeChecked();
  await expect(periodButton).toHaveAccessibleName(
    "Periode: Hittil i år (t.o.m. i går)",
  );
  await expect(
    page
      .getByText("Mot 25. des. 2025–31. des. 2025", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await comparison.uncheck();
  await periodButton.click();
  await page.getByRole("button", { name: "Siste 30 hele dager" }).click();
  await expect(comparison).not.toBeChecked();
});

test("comparison controls show exact dates, preserve filters, and can be turned off", async ({
  page,
}) => {
  await page.goto(`/?${period}&surveyId=survey-custom&deviceType=mobile`);
  const comparison = page.getByRole("checkbox", {
    name: "Sammenlign med forrige periode",
  });
  await expect(comparison).toBeChecked();
  await expect(
    page
      .getByText("Mot 5. aug. 2026–18. aug. 2026", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await comparison.uncheck();
  await expect(page).toHaveURL(/deviceType=mobile/);
  await expect(page).toHaveURL(/compare=none/);
  await expect(
    page.getByText("Mot 5. aug. 2026–18. aug. 2026", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Før", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Endring", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(comparison).not.toBeChecked();
  await comparison.focus();
  await page.keyboard.press("Space");
  await expect(comparison).toBeChecked();
  await expect(page).toHaveURL(/compare=previous/);
  await expect(page).toHaveURL(/deviceType=mobile/);
  await expect(
    page.getByText("Mot 5. aug. 2026–18. aug. 2026", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Før", exact: true }).first(),
  ).toBeVisible();
});

test("legacy year-comparison links fall back to the preceding period", async ({
  page,
}) => {
  await page.goto(`/?${period}&surveyId=survey-custom&compare=year`);
  await expect(
    page.getByRole("checkbox", { name: "Sammenlign med forrige periode" }),
  ).toBeChecked();
  await expect(
    page.getByText("Mot 5. aug. 2026–18. aug. 2026", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Samme periode i fjor", { exact: true }),
  ).toHaveCount(0);
});

test("a full year compares calendar years and today's comparison is marked provisional", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-07T12:00:00Z"));
  await page.goto(
    "/?dateMode=fixed&fromDate=2025-01-01&toDate=2025-12-31&surveyId=survey-vurdering&variant=hybrid",
  );
  const comparison = page.getByRole("checkbox", {
    name: "Sammenlign med forrige periode",
  });
  await expect(comparison).toBeChecked();
  await expect(
    page
      .getByText("Mot 1. jan. 2024–31. des. 2024", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto(
    "/?dateMode=fixed&fromDate=2026-01-01&toDate=2026-09-07&surveyId=survey-vurdering&variant=hybrid",
  );
  await expect(comparison).toBeChecked();
  await expect(
    page.getByText("Mot 26. apr. 2025–31. des. 2025", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Hele sammenligningsperioden er ikke lenger tilgjengelig. Tallene gjelder bare valgt periode.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Før", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("comparison-key-metrics").getByText("Endring"),
  ).toHaveCount(0);
  await page.goto(
    "/?dateMode=fixed&fromDate=2026-08-19&toDate=2026-09-07&surveyId=survey-vurdering",
  );
  await expect(
    page
      .getByText("Inkluderer i dag · foreløpig sammenligning")
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("comparison-key-metrics").getByText("Endring").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Før", exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/toDate=2026-09-07/);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByText("Inkluderer i dag · foreløpig sammenligning"),
    ).toHaveCount(1);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`provisional-${width}.png`),
    });
  }
  await comparison.uncheck();
  await expect(
    page.getByText("Inkluderer i dag · foreløpig sammenligning"),
  ).toHaveCount(0);
  await page.goto(
    "/?dateMode=fixed&fromDate=2026-01-01&toDate=2026-09-08&surveyId=survey-vurdering&variant=hybrid",
  );
  await expect(
    page.getByText("Velg en sluttdato senest i dag for å sammenligne."),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Før", exact: true }),
  ).toHaveCount(0);
});

test("revised rating overview keeps detail discoverable and passes accessibility checks", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/?${period}&surveyId=survey-vurdering`);
  await expect(page.getByTestId("field-stats-section")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Antall tilbakemeldinger", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Enheter", exact: true }),
  ).toBeVisible();
  const ratingTable = page.getByRole("table", {
    name: "Sammenligning: Gjennomsnitt",
    exact: true,
  });
  await expect(ratingTable.getByRole("cell").last()).toContainText("poeng");
  const fieldHeading = await page
    .getByRole("heading", { name: "Statistikk per felt", exact: true })
    .boundingBox();
  const trendHeading = await page
    .getByRole("heading", { name: "Gjennomsnittlig vurdering", exact: true })
    .boundingBox();
  expect(fieldHeading?.y).toBeLessThan(trendHeading?.y ?? 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("rating-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(
    page.getByRole("checkbox", { name: "Sammenlign med forrige periode" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("rating-mobile.png"),
    fullPage: true,
  });
});

for (const width of [1280, 768, 390, 320]) {
  test(`period editor fits and remains usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?${period}&surveyId=survey-vurdering`);
    const trigger = page.getByRole("button", { name: /^Periode:/ });
    await expect(trigger).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("controls.png") });
    await trigger.click();
    const editor = page.getByRole("dialog", {
      name: "Velg periode",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await expect(
      editor.getByRole("button", { name: /automatisk periode/i }),
    ).toHaveCount(0);
    await editor.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      );
    });
    await expect(
      editor.getByRole("textbox", { name: "Fra", exact: true }),
    ).toHaveValue("19.08.2026");
    await expect(
      editor.getByRole("textbox", { name: "Til", exact: true }),
    ).toHaveValue("01.09.2026");
    const bounds = await editor.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
    const accessibility = await new AxeBuilder({ page })
      .include('dialog[open], [role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("period-editor.png") });
    await editor.getByTitle("Åpne datovelger").first().click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(editor).toBeVisible();
    const to = editor.getByRole("textbox", { name: "Til", exact: true });
    await to.fill("31.08.2026");
    await to.press("Tab");
    await editor
      .getByRole("button", { name: "Velg periode", exact: true })
      .click();
    await expect(editor).not.toBeVisible();
    await expect(page).toHaveURL(/toDate=2026-08-31/);
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("small filtered samples stay visible in the dashboard", async ({
  page,
}) => {
  await page.goto(
    "/?dateMode=fixed&fromDate=2026-08-19&toDate=2026-08-19&surveyId=survey-custom&variant=hybrid",
  );
  const metrics = page.getByTestId("comparison-key-metrics");
  await expect(metrics.getByText(/^[1-4]$/)).toBeVisible();
  const fields = page.getByTestId("field-stats-section");
  await expect(
    fields.getByRole("heading", { name: "Rolle", exact: true }),
  ).toBeVisible();
  await expect(fields.getByRole("table").first()).toBeVisible();
  await expect(page.getByText(/skjult av personvernhensyn/)).toHaveCount(0);
});

test("custom surveys keep key metrics minimal and compare text counts", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/?${period}&surveyId=survey-custom`);
  const metrics = page.getByTestId("comparison-key-metrics");
  await expect(
    metrics.getByText("Tilbakemeldinger", { exact: true }),
  ).toBeVisible();
  await expect(
    metrics.getByText("Snitt vurdering", { exact: true }),
  ).toHaveCount(0);
  await expect(
    metrics.getByText("Andel med tekst", { exact: true }),
  ).toHaveCount(0);
  const textComparison = page
    .getByRole("table", { name: /Sammenligning av tekstsvar:/ })
    .first();
  await expect(
    textComparison.getByRole("rowheader", { name: "Tekstsvar" }),
  ).toBeVisible();
  await expect(textComparison.getByRole("cell").last()).toHaveText(/[+−\d]/);
  await expect(textComparison).not.toContainText("%");
  await page.screenshot({
    path: testInfo.outputPath("custom-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(textComparison).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("custom-mobile.png"),
    fullPage: true,
  });
});

test("NPS comparisons retain their labels and table headers on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/?${period}&surveyId=survey-nps`);
  const comparison = page.getByRole("table", {
    name: "Sammenligning: NPS",
    exact: true,
  });
  await expect(comparison).toBeVisible();
  await expect(
    comparison.getByRole("rowheader", { name: "NPS", exact: true }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("columnheader", { name: "Før", exact: true }),
  ).toHaveCount(1);
  await expect(comparison.getByRole("cell").last()).toContainText(/NPS-poeng/);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("a failed previous period preserves current data and removes comparison columns", async ({
  page,
}) => {
  let failPreviousPeriod = true;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const payload = `${decodeURIComponent(request.url())} ${request.postData() ?? ""}`;
    if (
      ["fetch", "xhr"].includes(request.resourceType()) &&
      payload.includes("2026-08-05") &&
      failPreviousPeriod
    ) {
      await route.fulfill({
        status: 500,
        body: "simulated previous-period failure",
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`/?${period}&surveyId=survey-custom`);
  await expect(page.getByRole("alert")).toContainText(
    "Perioden før kunne ikke hentes",
    { timeout: 20000 },
  );
  const fields = page.getByTestId("field-stats-section");
  await expect(fields).toBeVisible();
  await expect(
    fields.getByRole("heading", { name: "Rolle", exact: true }),
  ).toBeVisible();
  await expect(
    fields.getByRole("columnheader", { name: "Før", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Endring", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prøv sammenligningen igjen" }),
  ).toBeVisible();
  failPreviousPeriod = false;
  await page
    .getByRole("button", { name: "Prøv sammenligningen igjen" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    fields.getByRole("columnheader", { name: "Før", exact: true }).first(),
  ).toBeVisible();
});
