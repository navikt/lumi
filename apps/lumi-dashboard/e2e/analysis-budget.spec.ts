import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// E2E fixture: the mock refuses this survey's analyses for periods longer
// than 30 days, like the API does when a period has too many answers.
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

// The period ends two days ago, before today in any time zone. The shorter
// period ends on the same day, so the expected dates are counted from TO_DATE.
const TO_DATE = addDays(localToday(), -2);
const longPeriod = `dateMode=fixed&fromDate=${addDays(TO_DATE, -89)}&toDate=${TO_DATE}`;

async function expectLast30DaysOfPeriod(page: Page) {
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
      fromDate: addDays(TO_DATE, -29),
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
  test("an analysis with too many answers offers the last 30 days of the period", async ({
    page,
  }) => {
    await page.goto(`/?surveyId=${SURVEY_ID}&${longPeriod}`);

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Perioden har for mange svar" });
    await expect(alert).toContainText(
      "Top Tasks-analysen kan ikke regnes ut for så mange svar. Velg en kortere periode.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert
      .getByRole("button", { name: "Vis de siste 30 dagene i perioden" })
      .click();

    await expectLast30DaysOfPeriod(page);
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-period-trigger]").filter({ visible: true }),
    ).toBeFocused();
  });

  test("filtering feedback on a task explains what helps", async ({ page }) => {
    await page.goto(
      `/feedback?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Perioden har for mange svar" });
    await expect(alert).toContainText(
      "Lumi kan ikke filtrere på oppgave, tema eller uttrykk i så mange svar. Velg en kortere periode, eller fjern filteret.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert
      .getByRole("button", { name: "Vis de siste 30 dagene i perioden" })
      .click();

    await expectLast30DaysOfPeriod(page);
    await expect(alert).toHaveCount(0);
  });

  test("an export filtered on a task explains the limit in Norwegian", async ({
    page,
  }) => {
    await page.goto(
      `/export?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Perioden har for mange svar" });
    // The server renders the button before React handles clicks on it.
    await expect(async () => {
      await page.getByRole("button", { name: "Last ned CSV" }).click();
      await expect(alert).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await expect(alert).toContainText(
      "Lumi kan ikke filtrere på oppgave, tema eller uttrykk i så mange svar.",
    );
    await expect(alert).not.toContainText("Too much feedback data");
    await expect(page.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );
    await expectNoAxeViolations(page);

    await alert
      .getByRole("button", { name: "Vis de siste 30 dagene i perioden" })
      .click();

    await expectLast30DaysOfPeriod(page);
    await expect(alert).toHaveCount(0);
  });
});
