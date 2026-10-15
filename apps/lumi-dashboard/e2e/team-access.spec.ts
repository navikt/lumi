import { expect, type Page, test } from "@playwright/test";

const NO_ACCESS = "Du har ikke tilgang til team «team-x».";

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
  }
});
