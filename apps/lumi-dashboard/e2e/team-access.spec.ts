import { expect, type Locator, type Page, test } from "@playwright/test";

const NO_ACCESS = "Du har ikke tilgang til team «team-x».";

/**
 * True when the page's server functions have been quiet for longer than the
 * one retry the queries make after a failure.
 */
function trackServerFunctions(page: Page, quietMs = 2000) {
  let pending = 0;
  let finished = 0;
  let lastActivity = Date.now();
  const isServerFunction = (url: string) => url.includes("/_serverFn/");
  page.on("request", (request) => {
    if (!isServerFunction(request.url())) return;
    pending += 1;
    lastActivity = Date.now();
  });
  const settle = (request: { url: () => string }) => {
    if (!isServerFunction(request.url())) return;
    pending -= 1;
    finished += 1;
    lastActivity = Date.now();
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return {
    isQuiet: () =>
      finished > 0 && pending === 0 && Date.now() - lastActivity >= quietMs,
  };
}

const PAGE_CONTENT: Record<string, (page: Page) => Locator> = {
  "/": (page) =>
    page.getByRole("heading", { name: "Tilbakemeldinger per app" }),
  "/feedback": (page) => page.getByRole("table"),
  "/export": (page) => page.getByRole("heading", { name: "Velg format" }),
};

async function expectOnlyTheTeamAlert(page: Page) {
  const alerts = page.getByRole("alert");
  await expect(alerts.filter({ hasText: NO_ACCESS })).toBeVisible({
    timeout: 15000,
  });
  await expect(alerts).toHaveCount(1);
  await expect(page.getByText(/^Kunne ikke hente/)).toHaveCount(0);
}

test.describe("Link to a team without access", () => {
  for (const [name, path] of [
    ["Dashboard", "/"],
    ["Tilbakemeldinger", "/feedback"],
    ["Eksporter", "/export"],
  ] as const) {
    test(`${name} shows one alert and links to the default team`, async ({
      page,
    }) => {
      await page.goto(`${path}?team=team-x`);
      await expectOnlyTheTeamAlert(page);

      await page.getByRole("link", { name: "Gå til standardteamet" }).click();

      await expect
        .poll(() => new URL(page.url()).searchParams.get("team"), {
          timeout: 10000,
        })
        .toBe("team-esyfo");
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.getByText(NO_ACCESS)).toHaveCount(0);
      await expect(
        page.getByRole("combobox", { name: "Survey" }).first(),
      ).toBeVisible({ timeout: 15000 });
    });

    test(`${name} hides its own content after its queries are refused`, async ({
      page,
    }) => {
      const serverFunctions = trackServerFunctions(page);
      await page.goto(`${path}?team=team-x`);
      await expectOnlyTheTeamAlert(page);

      // The page's own queries are refused like the filters. Wait for them,
      // so a page that shows their error or data after the alert fails here.
      await expect
        .poll(() => serverFunctions.isQuiet(), { timeout: 20000 })
        .toBe(true);
      await expectOnlyTheTeamAlert(page);
      await expect(PAGE_CONTENT[path](page)).toHaveCount(0);
      await expect(page.getByText("Ingen svar ennå")).toHaveCount(0);
    });
  }

  test("hides filter chips from a shared link", async ({ page }) => {
    await page.goto(
      "/feedback?team=team-x&hasText=true&lowRating=true&deviceType=mobile",
    );
    await expectOnlyTheTeamAlert(page);

    await expect(page.getByText(/^Vis kun: /)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Fjern filter/ }),
    ).toHaveCount(0);
  });
});
