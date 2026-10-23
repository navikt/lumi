import { expect, type Page, test } from "@playwright/test";

/**
 * Hydration problems in the browser console. In development the client logs
 * recoverable errors with a "[hydration]" prefix; production builds report
 * them as minified React errors.
 */
const HYDRATION_PROBLEM = /hydrat|Minified React error/i;

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_PROBLEM.test(message.text())) {
      problems.push(message.text());
    }
  });
  return problems;
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
}

test("shows the not-found page inside the page frame", async ({ page }) => {
  const problems = collectProblems(page);

  const response = await page.goto("/finnes-ikke");
  await waitForHydration(page);

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Siden finnes ikke" }),
  ).toBeVisible();
  await expectPageFrame(page);
  expect(problems).toEqual([]);
});

test("keeps the page frame when a route below the root fails", async ({
  page,
}) => {
  // The editor requires team in the address. Without it, the route fails
  // its search validation during server rendering.
  const response = await page.goto(
    "/surveyverksted/00000000-0000-4000-8000-000000000000",
  );
  await waitForHydration(page);

  expect(response?.status()).toBe(500);
  await expect(
    page.getByRole("heading", { name: "En uventet feil oppstod" }),
  ).toBeVisible();
  await expect(
    page.getByText("Siden kunne ikke vises. Prøv å laste den inn på nytt."),
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
  // Unlike the tests above, this one does not check the console. TanStack
  // Router throws the route's error again in the browser, and because
  // ThemeProvider changes the theme right after hydration, React reports
  // that as a recovered error (#520).
});
