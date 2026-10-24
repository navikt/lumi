import { expect, type Page, test } from "@playwright/test";

/**
 * Errors in the console and uncaught errors in the page. A page that answers
 * with an error status also logs that status as a failed resource, which is
 * expected on these pages.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() !== "error") return;
    if (text.startsWith("Failed to load resource: the server responded")) {
      return;
    }
    errors.push(text);
  });
  return errors;
}

/**
 * The server does not know the viewer's theme, so the theme class on the
 * Aksel Theme wrapper appears only when ThemeProvider has hydrated.
 */
async function waitForHydration(page: Page) {
  await expect(page.locator("body > .app-theme-root")).toHaveClass(
    /(^|\s)(light|dark)(\s|$)/,
  );
}

async function expectPageFrame(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "no");
  await expect(page).toHaveTitle("Lumi Dashboard");
  await expect(page.getByRole("main")).toHaveCount(1);
}

test("shows the not-found page inside the page frame", async ({ page }) => {
  const errors = collectErrors(page);

  const response = await page.goto("/finnes-ikke");
  expect(response?.status()).toBe(404);
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", { name: "Siden finnes ikke" }),
  ).toBeVisible();
  await expectPageFrame(page);
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("explains what the survey preview address is missing", async ({
  page,
}) => {
  const errors = collectErrors(page);

  for (const [path, missing] of [
    ["/survey-preview", "team og projectId"],
    ["/survey-preview?team=&projectId=", "team og projectId"],
    ["/survey-preview?team=team-esyfo", "projectId"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { name: "Forhåndsvisningen kan ikke vises" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `Adressen mangler ${missing}. Åpne surveyen i Surveyverksted og velg «Prøv i egen fane».`,
      ),
    ).toBeVisible();
    await expectPageFrame(page);
    await page.waitForLoadState("networkidle");
    expect(errors, path).toEqual([]);
  }
});

// React logs the route's own error, the zod issue for the missing team, when
// the error boundary of the route catches it.
const CAUGHT_ROUTE_ERROR = /"path": \[\s*"team"\s*\]/;

test("keeps the page frame when a route below the root fails", async ({
  page,
}) => {
  const errors = collectErrors(page);

  // The editor requires team in the address. Without it, the route fails
  // its search validation during server rendering.
  const response = await page.goto(
    "/surveyverksted/00000000-0000-4000-8000-000000000000",
  );
  expect(response?.status()).toBe(500);
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", { name: "En uventet feil oppstod" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Siden kunne ikke vises. Sjekk at adressen er riktig, eller last inn siden på nytt.",
    ),
  ).toBeVisible();
  // The validation message is zod issues as JSON, and TanStack's own error
  // page is in English. Neither may reach the page.
  await expect(page.locator("body")).not.toContainText("invalid_type");
  await expect(page.locator("body")).not.toContainText("Something went wrong");
  // The Surveyverksted layout above the failing route keeps its header.
  await expect(
    page.getByRole("navigation", { name: "Hovedmeny" }),
  ).toBeVisible();
  await expectPageFrame(page);

  await page.waitForLoadState("networkidle");
  expect(errors.filter((error) => !CAUGHT_ROUTE_ERROR.test(error))).toEqual([]);
});
