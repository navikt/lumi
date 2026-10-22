import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// E2E fixture: the mock refuses this survey's analyses for periods longer
// than 30 days, like the API does when a period has too many answers.
const SURVEY_ID = "survey-analysegrense";
const TASK_ID = "lage-oppfolgingsplan";

/** A local calendar date, like the period buttons write it. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const longPeriod = `dateMode=fixed&fromDate=${daysAgo(89)}&toDate=${daysAgo(0)}`;

async function expectLast30Days(page: Page) {
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
      fromDate: daysAgo(29),
      toDate: daysAgo(0),
      page: "1",
    });
}

test.describe("Analysis budget", () => {
  test("an analysis with too many answers offers a shorter period instead of a retry", async ({
    page,
  }) => {
    await page.goto(`/?surveyId=${SURVEY_ID}&${longPeriod}`);

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Kunne ikke hente Top Tasks-data" });
    await expect(alert).toContainText(
      "Det er for mange svar i perioden til at analysen kan regnes ut. Velg en kortere periode.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    await alert.getByRole("button", { name: "Vis siste 30 dager" }).click();

    await expectLast30Days(page);
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-period-trigger]").filter({ visible: true }),
    ).toBeFocused();
  });

  test("filtering feedback on a task explains why the filter does not help", async ({
    page,
  }) => {
    await page.goto(
      `/feedback?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Kunne ikke hente tilbakemeldinger" });
    await expect(alert).toContainText(
      "Det er for mange svar i perioden til å filtrere på oppgave, tema eller frase. Velg en kortere periode.",
      { timeout: 15000 },
    );
    await expect(alert.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );

    await alert.getByRole("button", { name: "Vis siste 30 dager" }).click();

    await expectLast30Days(page);
    await expect(alert).toHaveCount(0);
  });

  test("an export filtered on a task explains the limit in Norwegian", async ({
    page,
  }) => {
    await page.goto(
      `/export?surveyId=${SURVEY_ID}&task=${TASK_ID}&${longPeriod}`,
    );

    const alert = page.getByRole("alert").filter({
      hasText:
        "Det er for mange svar i perioden til å filtrere på oppgave, tema eller frase.",
    });
    // The server renders the button before React handles clicks on it.
    await expect(async () => {
      await page.getByRole("button", { name: "Last ned CSV" }).click();
      await expect(alert).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await expect(alert).not.toContainText("Too much feedback data");
    await expect(page.getByRole("button", { name: "Prøv igjen" })).toHaveCount(
      0,
    );

    await alert.getByRole("button", { name: "Vis siste 30 dager" }).click();

    await expectLast30Days(page);
    await expect(alert).toHaveCount(0);
  });
});
