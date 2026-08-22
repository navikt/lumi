import { expect, type Route, test } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads dashboard page", async ({ page }) => {
    await page.goto("/");

    // Basic check that page loads
    await expect(page).toHaveTitle(/Lumi Dashboard|Dashboard/i);
  });

  test("displays main content", async ({ page }) => {
    await page.goto("/");

    // Check for main element
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("shows a retryable error instead of empty data when stats fail", async ({
    page,
  }) => {
    await page.goto("/");

    const surveySelect = page.getByRole("combobox", { name: "Survey" });
    await expect(surveySelect).toBeVisible();

    const failDashboardRequests = async (route: Route) => {
      const request = route.request();
      if (["fetch", "xhr"].includes(request.resourceType())) {
        await route.fulfill({ status: 500, body: "simulated stats failure" });
        return;
      }
      await route.continue();
    };
    await page.route("**/*", failDashboardRequests);

    await surveySelect.selectOption("survey-vurdering");

    const errorAlert = page.getByRole("alert");
    await expect(errorAlert).toContainText("Kunne ikke hente dashboarddata", {
      timeout: 15000,
    });
    await expect(page.getByText(/Ingen data for valgt periode/)).toHaveCount(0);

    await page.unroute("**/*", failDashboardRequests);
    await errorAlert.getByRole("button", { name: "Prøv igjen" }).click();

    await expect(errorAlert).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Dataene er lastet inn." }),
    ).toHaveCount(1);
    await expect(page.getByText("Vurdering", { exact: true })).toBeVisible();
  });

  test("archive visibility survives navigation and reload", async ({
    page,
  }) => {
    await page.goto("/");

    const surveySelect = page.getByRole("combobox", { name: "Survey" });
    const archiveSwitch = page.getByRole("checkbox", {
      name: /Arkiverte \(\d+\)/,
    });

    await expect(archiveSwitch).not.toBeChecked();
    await expect(
      surveySelect.locator('option[value="survey-thumbs"]'),
    ).toHaveCount(0);

    await archiveSwitch.check();
    await expect(page).toHaveURL(/showArchived=true/);
    await expect(
      surveySelect.locator('option[value="survey-thumbs"]'),
    ).toHaveCount(1);

    await page.getByRole("link", { name: "Tilbakemeldinger" }).click();
    await expect(page).toHaveURL(/\/feedback.*showArchived=true/);
    await expect(
      page.getByRole("checkbox", { name: /Arkiverte \(\d+\)/ }),
    ).toBeChecked();

    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: /Arkiverte \(\d+\)/ }),
    ).toBeChecked();
  });
});

test.describe("Feedback", () => {
  test("loads feedback page", async ({ page }) => {
    await page.goto("/feedback");

    // Check URL
    await expect(page).toHaveURL(/\/feedback/);
  });

  test("hides archived survey responses when archive visibility is off", async ({
    page,
  }) => {
    await page.goto(
      "/feedback?surveyId=survey-thumbs&showArchived=true&fromDate=2025-01-01&toDate=2026-12-31",
    );

    const feedbackTable = page.getByRole("table");
    await expect(
      feedbackTable.getByText("survey-thumbs", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("checkbox", { name: /Arkiverte \(\d+\)/ }).uncheck();

    await expect(page).not.toHaveURL(/showArchived=true/);
    await expect(page).not.toHaveURL(/surveyId=survey-thumbs/);
    await expect(
      feedbackTable.getByText("survey-thumbs", { exact: true }),
    ).toHaveCount(0);
  });

  test("keeps context and a valid focus target after archiving", async ({
    page,
  }) => {
    await page.goto("/feedback?surveyId=archive-focus-test");

    await page
      .getByRole("button", {
        name: "Skjul surveyen i dashboardet — innsendinger stoppes ikke",
      })
      .click();
    await page
      .getByRole("button", { name: "Arkiver survey", exact: true })
      .click();

    await expect(page).toHaveURL(/surveyId=archive-focus-test/);
    await expect(page).toHaveURL(/showArchived=true/);
    const restoreButton = page.getByRole("button", {
      name: "Gjenopprett surveyen fra arkivet",
    });
    await expect(restoreButton).toBeVisible();
    await expect(restoreButton).toBeFocused();

    await restoreButton.click();
  });
});
