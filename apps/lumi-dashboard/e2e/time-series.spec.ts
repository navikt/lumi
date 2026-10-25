import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Today's date in Oslo, as the dashboard counts it. */
const TODAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
}).format(new Date());

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return shiftDate(date, -weekday);
}

// Over 92 days, the time series are shown per ISO week. The mock only has
// answers for the last 60 days, and the note names partial weeks with
// answers. The last week must therefore be partial, and on a Sunday the
// period ends on Saturday.
const PERIOD_DAYS = 120;
const TO_DATE =
  new Date(`${TODAY}T12:00:00Z`).getUTCDay() === 0
    ? shiftDate(TODAY, -1)
    : TODAY;
const FROM_DATE = shiftDate(TO_DATE, -(PERIOD_DAYS - 1));
const longPeriod = `dateMode=fixed&fromDate=${FROM_DATE}&toDate=${TO_DATE}`;
const weeksInPeriod =
  Math.round(
    (Date.parse(mondayOf(TO_DATE)) - Date.parse(mondayOf(FROM_DATE))) /
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
    await expect(
      page.getByText(
        /^Bare \d av 7 dager i uke \d{1,2}( i \d{4})? er med i grafen\. Uka har lysere søyle med stiplet kant\.$/,
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
