import { expect, test } from "@playwright/test";

const topTasksDashboard =
  "/?surveyId=survey-top-tasks&dateMode=fixed&fromDate=2000-01-01&toDate=2099-12-31";

test.describe("Top Tasks - Task Filter", () => {
  test("clicking on task quadrant point updates URL with task filter", async ({
    page,
  }) => {
    await page.goto(topTasksDashboard);
    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Find and click on a scatter point in the quadrant chart
    const scatterChart = page.locator(".recharts-scatter-symbol").first();
    await expect(scatterChart).toBeVisible({ timeout: 5000 });
    await scatterChart.click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("task"), {
        timeout: 5000,
      })
      .not.toBeNull();
    await expect(
      page.getByRole("button", { name: /Fjern filter Oppgave:/ }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("removing task filter chip clears URL parameter", async ({ page }) => {
    await page.goto(`${topTasksDashboard}&task=lage-oppfolgingsplan`);
    await expect(
      page.getByRole("heading", { name: "Oppgavekvadrant", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    const removeButton = page.getByRole("button", {
      name: /Fjern filter Oppgave:/,
    });
    await expect(removeButton).toBeVisible({ timeout: 5000 });
    await removeButton.click();

    // URL should no longer contain task parameter
    await expect
      .poll(() => new URL(page.url()).searchParams.get("task"), {
        timeout: 5000,
      })
      .toBeNull();
  });

  test("task filter persists in URL after page reload", async ({ page }) => {
    const taskId = "lage-oppfolgingsplan";
    const topTasksHeading = page.getByRole("heading", {
      name: "Oppgavekvadrant",
      exact: true,
    });
    const removeButton = page.getByRole("button", {
      name: /Fjern filter Oppgave:/,
    });
    await page.goto(`${topTasksDashboard}&task=${taskId}`);
    await expect(topTasksHeading).toBeVisible({ timeout: 15000 });
    await expect(removeButton).toBeVisible({ timeout: 5000 });

    await page.reload();

    await expect(topTasksHeading).toBeVisible({ timeout: 15000 });
    await expect(removeButton).toBeVisible({ timeout: 5000 });
    expect(new URL(page.url()).searchParams.get("task")).toBe(taskId);
  });
});
