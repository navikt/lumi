import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** A local calendar date, like the period buttons write it. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function mondayOf(daysBack: number): number {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

// 120 days is longer than 92, so the time series are shown per ISO week.
// The mock has answers for the last 60 days only, so the last week must be
// the partial one. On a Sunday the period therefore ends on Saturday.
const PERIOD_DAYS = 120;
const END_DAYS_AGO = new Date().getDay() === 0 ? 1 : 0;
const longPeriod = `dateMode=fixed&fromDate=${daysAgo(END_DAYS_AGO + PERIOD_DAYS - 1)}&toDate=${daysAgo(END_DAYS_AGO)}`;
const weeksInPeriod =
  Math.round(
    (mondayOf(END_DAYS_AGO) - mondayOf(END_DAYS_AGO + PERIOD_DAYS - 1)) /
      (7 * 864e5),
  ) + 1;

test.describe("Time series over long periods", () => {
  test("the overview counts answers per week and marks partial weeks", async ({
    page,
  }) => {
    await page.goto(`/?${longPeriod}`);

    await expect(
      page.getByRole("img", {
        name: `Søylediagram som viser antall tilbakemeldinger per uke for ${weeksInPeriod} uker`,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Per uke", { exact: true })).toBeVisible();
    // 120 days is not a whole number of weeks, so a week is partial.
    await expect(
      page.getByText(
        /er bare delvis med i perioden og har lysere søyle med stiplet kant\./,
      ),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: /^Vis som tabell\s*: Antall tilbakemeldinger per uke$/,
      })
      .click();
    const table = page.getByRole("table", {
      name: "Antall tilbakemeldinger per uke",
    });
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Uke" }),
    ).toBeVisible();
    const weeks = table.getByRole("rowheader");
    await expect(weeks).toHaveCount(weeksInPeriod);
    await expect(weeks.first()).toHaveText(/^Uke \d{1,2}, \d{4} · /);
    await expect(table.getByText(/\(\d av 7 dager\)$/).first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("a rating survey shows its average and its question trend per week", async ({
    page,
  }) => {
    await page.goto(`/?surveyId=survey-vurdering&${longPeriod}`);

    await expect(
      page.getByRole("img", { name: /^Linjediagram som viser .+ per uke/ }),
    ).toBeVisible({ timeout: 15000 });
    await page
      .getByRole("button", {
        name: /^Vis som tabell\s*: Gjennomsnittlig vurdering per uke$/,
      })
      .click();
    await expect(
      page
        .getByRole("table", { name: "Gjennomsnittlig vurdering per uke" })
        .getByRole("rowheader")
        .first(),
    ).toHaveText(/^Uke \d{1,2}, \d{4} · /);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    await page
      .getByRole("button", { name: /^Se utvikling for / })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("radio", { name: "Uke", exact: true }),
    ).toBeChecked();
    expect(new URL(page.url()).searchParams.has("trendInterval")).toBe(false);
    await expect(
      dialog
        .getByRole("table", { name: "Utvikling per uke" })
        .getByRole("rowheader")
        .first(),
    ).toHaveText(/^Uke \d{1,2}, \d{4} · /);
  });
});
