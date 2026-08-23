import { expect, type Page, test } from "@playwright/test";

const HISTORICAL_SURVEY_ID = "survey-historical";
const HISTORICAL_FROM_DATE = "2024-02-10";
const HISTORICAL_TO_DATE = "2024-02-18";
const SHARED_SURVEY_ID = "survey-shared-apps";
const OLDER_APP = "dialogmote-frontend";
const OLDER_APP_FROM_DATE = "2021-04-01";
const OLDER_APP_TO_DATE = "2021-04-06";

async function expectSearchParams(
  page: Page,
  expected: Record<string, string>,
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

test.describe("Dashboard response period", () => {
  test("manual survey overview refresh is available on every filter route", async ({
    page,
  }) => {
    await page.goto("/?dateMode=fixed&fromDate=2024-01-01&toDate=2024-01-31");
    await page.waitForLoadState("networkidle");

    const refresh = page.getByRole("button", {
      name: "Oppdater surveyoversikt",
    });
    await expect(refresh).toHaveCount(1);
    const refreshResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/_serverFn/") &&
        response.request().method() === "POST",
    );
    await refresh.click();
    const refreshResponse = await refreshResponsePromise;
    expect(refreshResponse.headers()["cache-control"]).toContain("no-store");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Surveyoversikten er oppdatert." }),
    ).toHaveCount(1);
    await expectSearchParams(page, {
      dateMode: "fixed",
      fromDate: "2024-01-01",
      toDate: "2024-01-31",
    });

    await page.getByRole("link", { name: "Tilbakemeldinger" }).click();
    await expect(
      page.getByRole("button", { name: "Oppdater surveyoversikt" }),
    ).toHaveCount(1);

    await page.getByRole("link", { name: "Eksporter" }).click();
    await expect(
      page.getByRole("button", { name: "Oppdater surveyoversikt" }),
    ).toHaveCount(1);
  });

  test("selecting an old survey finds its responses and keeps the automatic period across routes", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("combobox", { name: "Survey" })
      .selectOption(HISTORICAL_SURVEY_ID);

    const automaticPeriod = {
      surveyId: HISTORICAL_SURVEY_ID,
      dateMode: "auto",
      fromDate: HISTORICAL_FROM_DATE,
      toDate: HISTORICAL_TO_DATE,
      page: "1",
    };
    await expectSearchParams(page, automaticPeriod);

    await expect(
      page.getByRole("img", {
        name: /Stolpediagram som viser \d+ dager med tilbakemeldinger/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Ingen data for valgt periode")).toHaveCount(0);

    await page.getByRole("link", { name: "Tilbakemeldinger" }).click();
    await expect(page).toHaveURL(/\/feedback/);
    await expectSearchParams(page, automaticPeriod);
    await expect(
      page
        .getByRole("table")
        .getByText(HISTORICAL_SURVEY_ID, { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Ingen tilbakemeldinger|Ingen treff/),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Eksporter" }).click();
    await expect(page).toHaveURL(/\/export/);
    await expectSearchParams(page, automaticPeriod);
    await expect(
      page.getByRole("heading", { name: "Aktive filtre" }),
    ).toBeVisible();
    await expect(page.getByText(/Fra:\s*10\.02\.2024/)).toBeVisible();
    await expect(page.getByText(/Til:\s*18\.02\.2024/)).toBeVisible();
  });

  test("a legacy fixed bookmark offers the full response period without returning to auto mode", async ({
    page,
  }) => {
    await page.goto(
      `/?surveyId=${HISTORICAL_SURVEY_ID}&fromDate=2035-01-01&toDate=2035-01-30&page=7`,
    );

    await expectSearchParams(page, {
      surveyId: HISTORICAL_SURVEY_ID,
      dateMode: "fixed",
      fromDate: "2035-01-01",
      toDate: "2035-01-30",
      page: "7",
    });
    await expect(page.getByText("Ingen data for valgt periode")).toBeVisible();

    const showFullResponsePeriod = page.getByRole("button", {
      name: "Vis hele svarperioden",
    });
    await expect(showFullResponsePeriod).toBeVisible();
    await showFullResponsePeriod.click();

    await expectSearchParams(page, {
      surveyId: HISTORICAL_SURVEY_ID,
      dateMode: "fixed",
      fromDate: HISTORICAL_FROM_DATE,
      toDate: HISTORICAL_TO_DATE,
      page: "1",
    });
    await expect(
      page.getByRole("img", {
        name: /Stolpediagram som viser \d+ dager med tilbakemeldinger/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Ingen data for valgt periode")).toHaveCount(0);
  });

  test("a shared survey ID uses the selected app's older response period", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("combobox", { name: "App" }).selectOption(OLDER_APP);
    const surveySelect = page.getByRole("combobox", { name: "Survey" });
    await expect(
      surveySelect.locator(`option[value="${SHARED_SURVEY_ID}"]`),
    ).toHaveCount(1);
    await surveySelect.selectOption(SHARED_SURVEY_ID);

    await expectSearchParams(page, {
      app: OLDER_APP,
      surveyId: SHARED_SURVEY_ID,
      dateMode: "auto",
      fromDate: OLDER_APP_FROM_DATE,
      toDate: OLDER_APP_TO_DATE,
      page: "1",
    });
    await expect(
      page.getByRole("img", {
        name: /Stolpediagram som viser \d+ dager med tilbakemeldinger/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Ingen data for valgt periode")).toHaveCount(0);
  });
});
