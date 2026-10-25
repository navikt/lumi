import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const SINCE_FIRST = "dateMode=relative&periodPreset=sinceFirst";
// The mock's rating survey with answers from 10 to 18 February 2024.
const HISTORICAL_SURVEY_ID = "survey-historical";
// One survey in two apps: from 1 April 2021 in one, from 10 November 2025 in
// the other.
const SHARED_SURVEY_ID = "survey-shared-apps";
const NEWER_APP = "syfo-oppfolgingsplan-frontend";

/** Today in Oslo, read when a test needs it. */
function osloToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(
    new Date(),
  );
}

function norwegianDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function isoDate(norwegian: string) {
  const [day, month, year] = norwegian.split(".");
  return `${year}-${month}-${day}`;
}

/** Days from the first to the last date, both included. */
function daysInPeriod(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

/** The days as the Periode card writes them, with a no-break space. */
function daysPattern(days: number) {
  const formatted = days.toLocaleString("no-NO").replace(/\s/g, "\\s");
  return new RegExp(`^${formatted}d$`);
}

/** The server function a request calls, read from its id. */
function serverFunction(url: string) {
  const id = new URL(url).pathname.split("/_serverFn/")[1] ?? "";
  try {
    return String(JSON.parse(Buffer.from(id, "base64url").toString()).export);
  } catch {
    return "";
  }
}

async function expectSearchParams(
  page: Page,
  expected: Record<string, string | null>,
) {
  await expect
    .poll(() => {
      const search = new URL(page.url()).searchParams;
      return Object.fromEntries(
        Object.keys(expected).map((key) => [key, search.get(key)]),
      );
    })
    .toEqual(expected);
}

function sinceFirstParams(today = osloToday()) {
  return {
    dateMode: "relative",
    periodPreset: "sinceFirst",
    toDate: today,
    fromDate: null,
  };
}

/** The filter bar has a period button for narrow and one for wide screens. */
function periodButton(page: Page) {
  return page
    .getByRole("button", { name: /^Periode:/ })
    .filter({ visible: true });
}

const SINCE_FIRST_NAME = /^Periode: Fra første svar \((\d{2}\.\d{2}\.\d{4})\)$/;

test.describe("«Fra første svar»", () => {
  test("is reached with the keyboard and follows the reader across views and reloads", async ({
    page,
  }) => {
    const today = osloToday();
    await page.goto("/");
    await periodButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Velg periode" }),
    ).toBeVisible();
    // Tab through the quick picks to the last one.
    let reached = false;
    for (let step = 0; step < 15 && !reached; step++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(
        () => document.activeElement?.textContent?.trim() === "Fra første svar",
      );
    }
    expect(reached).toBe(true);
    await page.keyboard.press("Enter");

    await expectSearchParams(page, { ...sinceFirstParams(today), page: "1" });
    await expect(periodButton(page)).toBeFocused();
    await expect(periodButton(page)).toHaveAccessibleName(SINCE_FIRST_NAME);
    const name = await periodButton(page).getAttribute("aria-label");
    const firstAnswer = name?.match(SINCE_FIRST_NAME)?.[1] as string;
    const firstDay = isoDate(firstAnswer);

    // The API counts a period without a start as 30 days.
    await expect(
      page.getByText(daysPattern(daysInPeriod(firstDay, today))),
    ).toBeVisible();
    await expect(page.getByText(`${firstDay} → ${today}`)).toBeVisible();
    await expect(page.getByText("30d", { exact: true })).toHaveCount(0);

    await page.reload();
    await expectSearchParams(page, sinceFirstParams(today));
    await expect(periodButton(page)).toHaveAccessibleName(
      `Periode: Fra første svar (${firstAnswer})`,
    );

    await page.getByRole("link", { name: "Tilbakemeldinger" }).click();
    await expect(page).toHaveURL(/\/feedback/);
    await expectSearchParams(page, sinceFirstParams(today));
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("link", { name: "Eksporter" }).click();
    await expect(page).toHaveURL(/\/export/);
    await expectSearchParams(page, sinceFirstParams(today));
    await expect(
      page.getByText(`Periode: Fra første svar (${firstAnswer})`),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Til:\\s*${norwegianDate(today)}`)),
    ).toBeVisible();
    await expect(page.getByText(/^Fra:/)).toHaveCount(0);
  });

  test("follows the first answer of the selected survey and app, and the archive switch", async ({
    page,
  }) => {
    await page.goto(`/?${SINCE_FIRST}`);

    const archived = page.getByRole("checkbox", { name: /Arkiverte \(\d+\)/ });
    await archived.check();
    await expectSearchParams(page, {
      ...sinceFirstParams(),
      showArchived: "true",
    });
    await archived.uncheck();

    await page
      .getByRole("combobox", { name: "Survey" })
      .filter({ visible: true })
      .selectOption(SHARED_SURVEY_ID);
    await expectSearchParams(page, {
      ...sinceFirstParams(),
      surveyId: SHARED_SURVEY_ID,
    });
    await expect(periodButton(page)).toHaveAccessibleName(
      "Periode: Fra første svar (01.04.2021)",
    );

    await page
      .getByRole("combobox", { name: "App" })
      .filter({ visible: true })
      .selectOption(NEWER_APP);
    await expectSearchParams(page, {
      ...sinceFirstParams(),
      surveyId: SHARED_SURVEY_ID,
      app: NEWER_APP,
    });
    await expect(periodButton(page)).toHaveAccessibleName(
      "Periode: Fra første svar (10.11.2025)",
    );
  });

  test("loads the statistics once for a link from an earlier day", async ({
    page,
  }) => {
    const statsCalls: string[] = [];
    page.on("request", (request) => {
      if (!request.url().includes("/_serverFn/")) return;
      if (!serverFunction(request.url()).startsWith("fetchStatsServerFn")) {
        return;
      }
      statsCalls.push(
        `${decodeURIComponent(request.url())} ${request.postData() ?? ""}`,
      );
    });

    await page.goto(`/?${SINCE_FIRST}&toDate=2020-01-01`);

    await expectSearchParams(page, sinceFirstParams());
    await expect(periodButton(page)).toHaveAccessibleName(SINCE_FIRST_NAME);
    await page.waitForLoadState("networkidle");
    expect(statsCalls).toHaveLength(1);
    expect(statsCalls[0]).not.toContain("2020-01-01");
  });

  test("has no previous period to compare with and asks for no start date", async ({
    page,
  }) => {
    const today = osloToday();
    const statsCalls: string[] = [];
    page.on("request", (request) => {
      if (!request.url().includes("/_serverFn/")) return;
      if (!serverFunction(request.url()).startsWith("fetchStatsServerFn")) {
        return;
      }
      statsCalls.push(
        `${decodeURIComponent(request.url())} ${request.postData() ?? ""}`,
      );
    });

    await page.goto(
      `/?surveyId=${HISTORICAL_SURVEY_ID}&${SINCE_FIRST}&compare=previous`,
    );

    // The address gets today's end, and the comparison choice stays.
    await expectSearchParams(page, {
      ...sinceFirstParams(today),
      compare: "previous",
    });
    await expect(periodButton(page)).toHaveAccessibleName(
      "Periode: Fra første svar (10.02.2024)",
    );
    await expect(
      page.getByText(
        "Ingen forrige periode å sammenligne med når perioden starter ved første svar.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Sammenlign med forrige periode" }),
    ).toHaveCount(0);

    // The charts start with the first answer, more than two years back.
    await expect(
      page.getByRole("img", { name: /per måned for \d+ måneder/ }).first(),
    ).toBeVisible();

    // Statistics for a previous period, or with a start, would have other
    // dates than today.
    await page.waitForLoadState("networkidle");
    expect(statsCalls.length).toBeGreaterThan(0);
    const otherDates = statsCalls
      .flatMap((call) => call.match(/\d{4}-\d{2}-\d{2}/g) ?? [])
      .filter((date) => date !== today);
    expect(otherDates).toEqual([]);
  });

  for (const [season, time, before, after] of [
    // 23:58 in Oslo, in winter and in summer time. The server's date is the
    // real one.
    ["winter", "2027-01-15T22:58:00Z", "2027-01-15", "2027-01-16"],
    ["summer", "2027-07-15T21:58:00Z", "2027-07-15", "2027-07-16"],
  ] as const) {
    test(`ends on the new day after midnight and keeps the page (${season} time)`, async ({
      page,
    }) => {
      await page.clock.install({ time: new Date(time) });
      await page.goto(`/feedback?${SINCE_FIRST}&page=3`);
      await expectSearchParams(page, {
        ...sinceFirstParams(before),
        page: "3",
      });

      await page.clock.fastForward("03:00");

      await expectSearchParams(page, {
        ...sinceFirstParams(after),
        page: "3",
      });
    });
  }

  for (const [route, width] of [
    ["/", 1280],
    ["/", 768],
    ["/", 390],
    ["/", 320],
    // With one rating survey, the period sits next to the comparison: a
    // popover on wide screens and a modal on narrow ones.
    [`/?surveyId=${HISTORICAL_SURVEY_ID}&`, 1280],
    [`/?surveyId=${HISTORICAL_SURVEY_ID}&`, 390],
  ] as const) {
    test(`has no WCAG A/AA violations with the period editor open on ${route} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const separator = route.endsWith("&") ? "" : "?";
      await page.goto(`${route}${separator}${SINCE_FIRST}`);
      await page.waitForLoadState("networkidle");
      await periodButton(page).click();
      const editor = page.getByRole("dialog", { name: "Velg periode" });
      await expect(
        editor
          .getByRole("button", { name: "Fra første svar", exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      // Colours are checked when the editor has finished opening.
      await editor.evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished),
        );
      });

      // options() replaces what withTags() sets, so it comes first. The
      // visible text of a button must be part of its name (WCAG 2.5.3).
      const results = await new AxeBuilder({ page })
        .options({
          rules: { "label-content-name-mismatch": { enabled: true } },
        })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      if (results.violations.length > 0) {
        console.log(
          `«Fra første svar» a11y violations on ${route} at ${width}px:`,
          JSON.stringify(results.violations, null, 2),
        );
      }
      expect(results.violations).toEqual([]);
    });
  }
});
