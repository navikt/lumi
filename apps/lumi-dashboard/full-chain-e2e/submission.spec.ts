import { expect, test } from "@playwright/test";

const DEMO_URL = process.env.LUMI_DEMO_URL ?? "http://127.0.0.1:3001";
const DASHBOARD_URL = process.env.LUMI_DASHBOARD_URL ?? "http://127.0.0.1:3000";

test("a SurveyDocumentV1 response travels from the widget to the dashboard", async ({
  page,
}) => {
  const feedback = `full-chain-${Date.now()}`;

  await page.goto(DEMO_URL);
  await expect(
    page.getByRole("heading", { name: "Full-chain testbenk" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "4. Bra" }).click();
  await page
    .getByRole("textbox", { name: "Har du andre tilbakemeldinger?" })
    .fill(feedback);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByRole("heading", { name: "Signal lagret" }),
  ).toBeVisible();

  await page.goto(
    `${DASHBOARD_URL}/feedback?team=local-dev&app=local-app&surveyId=local-demo-rating-emoji&dateMode=auto`,
  );
  await expect(
    page.getByRole("table").getByText(feedback, { exact: true }).first(),
  ).toBeVisible();
});

test("the dev release rig stores and finds a synthetic response", async ({
  page,
}) => {
  const trace = `release-rig-${Date.now()}`;

  await page.goto(`${DASHBOARD_URL}/release-verification`);
  await expect(
    page.getByRole("heading", { name: "Bevis kjeden før utrulling" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "4. Bra" }).click();
  await page
    .getByRole("textbox", { name: "Legg inn en kort sporingsmerknad" })
    .fill(trace);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/API-et bekreftet ny lagring/)).toBeVisible();
  await page.getByRole("button", { name: "Kontroller i dashboardet" }).click();
  await expect(
    page.getByRole("table").getByText(trace, { exact: true }).first(),
  ).toBeVisible();
});
