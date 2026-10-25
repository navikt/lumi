import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// E2E fixture: the mock refuses this survey's analyses when they would read
// more than 25 answers. The survey has an answer every other day for the last
// 90 days. Its two tasks take turns, and one task fits.
const SURVEY_ID = "survey-analysegrense";
const TASK_ID = "lage-oppfolgingsplan";

/** Today as a local calendar date, like the period buttons write it. */
function localToday(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** «01.06.2026–30.06.2026», as the button writes the period. */
function periodLabel(fromDate: string, toDate: string): string {
  const format = (date: string) => date.split("-").reverse().join(".");
  return `${format(fromDate)}–${format(toDate)}`;
}

// The period ends two days ago, before today in any time zone and before the
// last answer. The suggestion ends on the same day.
const TO_DATE = addDays(localToday(), -2);
const SUGGESTED_FROM_DATE = addDays(TO_DATE, -29);
const longPeriod = `dateMode=fixed&fromDate=${addDays(TO_DATE, -89)}&toDate=${TO_DATE}`;

/** The filter bar shows its selects once the page has hydrated. */
async function waitForFilters(page: Page) {
  await expect(
    page.getByRole("combobox", { name: "Survey" }).first(),
  ).toBeVisible({ timeout: 15000 });
}

function budgetAlert(page: Page) {
  return page
    .getByRole("alert")
    .filter({ hasText: "Perioden har for mange svar" });
}

async function expectSuggestedPeriod(page: Page) {
  await expect
    .poll(() => {
      const search = new URL(page.url()).searchParams;
      return {
        dateMode: search.get("dateMode"),
        fromDate: search.get("fromDate"),
        toDate: search.get("toDate"),
        page: search.get("page"),
      };
    })
    .toEqual({
      dateMode: "fixed",
      fromDate: SUGGESTED_FROM_DATE,
      toDate: TO_DATE,
      page: "1",
    });
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe("Analysis budget", () => {
  test("an analysis with too many answers offers a shorter period that has the analysis", async ({
    page,
  }) => {
    await page.goto(`/?surveyId=${SURVEY_ID}&${longPeriod}`);
    await waitForFilters(page);

    const alert = budgetAlert(page);
    await expect(alert).toContainText(
      "Top Tasks-analysen kan ikke regnes ut for så mange svar. Velg en kortere periode.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert
      .getByRole("button", {
        name: `Vis perioden ${periodLabel(SUGGESTED_FROM_DATE, TO_DATE)}`,
      })
      .click();

    await expectSuggestedPeriod(page);
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^Periode:/ })).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test("Top Tasks with a task shows the analysis while Segmentering is refused", async ({
    page,
  }) => {
    await page.goto(`/?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`);
    await waitForFilters(page);

    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant" }),
    ).toBeVisible({ timeout: 15000 });
    const alert = budgetAlert(page);
    await expect(alert).toContainText(
      "Segmenteringen for den valgte oppgaven kan ikke regnes ut for så mange svar.",
      { timeout: 15000 },
    );
    await expect(alert).toHaveCount(1);
    await expectNoAxeViolations(page);
  });

  test("filtering feedback on a task explains what helps", async ({ page }) => {
    await page.goto(
      `/feedback?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );
    await waitForFilters(page);

    const alert = budgetAlert(page);
    await expect(alert).toContainText(
      "Lumi kan ikke filtrere så mange svar på oppgave, tema eller uttrykk. Velg en kortere periode, eller fjern filteret på oppgave.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert.getByRole("button", { name: /^Vis perioden / }).click();

    await expectSuggestedPeriod(page);
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Periode:/ })).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test("an export filtered on a task can remove the filter", async ({
    page,
  }) => {
    await page.goto(
      `/export?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );
    await waitForFilters(page);

    await page.getByRole("button", { name: "Last ned CSV" }).click();
    const alert = budgetAlert(page);
    await expect(alert).toContainText(
      "Lumi kan ikke filtrere så mange svar på oppgave, tema eller uttrykk. Velg en kortere periode, eller fjern filteret på oppgave.",
      { timeout: 15000 },
    );
    await expect(alert).not.toContainText("Too much feedback data");
    await expect(page.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert
      .getByRole("button", { name: "Fjern filteret på oppgave" })
      .click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("task"))
      .toBeNull();
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Last ned CSV" }),
    ).toBeFocused();
    await expectNoAxeViolations(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Last ned CSV" }).click();
    await download;
    await expect(
      page.getByText("Eksport fullført! Filen er lastet ned."),
    ).toBeVisible();
  });
});
