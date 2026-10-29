import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const surveyUrl = "/feedback?team=team-esyfo&surveyId=survey-redaction";
test.use({ screenshot: "only-on-failure" });

async function openMasking(page: Page, name: string, mobile = false) {
  await page.goto(`${surveyUrl}&query=${encodeURIComponent(name)}`);
  if (mobile)
    await page.getByRole("button", { name: "Vis mer", exact: true }).click();
  else await page.getByRole("button", { name: "Utvid rad" }).click();
  await page.getByRole("button", { name: "Masker tekst", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Masker fritekstsvar" }),
  ).toBeVisible();
  // Measure contrast after the modal's opening animation has finished.
  await page
    .getByRole("dialog", { name: "Masker fritekstsvar" })
    .evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      );
    });
}

async function selectName(page: Page, name: string) {
  const original = page.getByRole("textbox", {
    name: "Marker teksten som skal fjernes",
  });
  await original.focus();
  // Exercise the keyboard path. All fixture names are at the end of the answer.
  await original.press("ControlOrMeta+A");
  await original.press("ArrowRight");
  for (let index = 0; index < name.length; index++)
    await original.press("Shift+ArrowLeft");
  await expect
    .poll(() =>
      original.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    )
    .toBe(name);
  await expect(
    page.getByRole("region", { name: "Slik blir svaret" }),
  ).toContainText("Skjemaet var enkelt å bruke. Hilsen [TEKST FJERNET]");
}

test("desktop masking previews, cancels and removes the name from search and reload", async ({
  page,
}, testInfo) => {
  await openMasking(page, "Ola Nordmann");
  await selectName(page, "Ola Nordmann");
  const accessibility = await new AxeBuilder({ page })
    .include("dialog")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("masking-desktop.png") });
  await page.getByRole("button", { name: "Avbryt", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("Ola Nordmann");

  await page.getByRole("button", { name: "Masker tekst", exact: true }).click();
  await selectName(page, "Ola Nordmann");
  await page
    .getByRole("textbox", { name: "Marker teksten som skal fjernes" })
    .press("Tab");
  await expect(
    page.getByRole("button", { name: "Avbryt", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Masker permanent", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Teksten er maskert." }),
  ).toBeFocused();
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.goto(surveyUrl);
  await expect(page.getByRole("table")).toContainText("[TEKST FJERNET]");
  await expect(page.getByRole("table")).not.toContainText("Ola Nordmann");
  await page.reload();
  await expect(page.getByRole("table")).not.toContainText("Ola Nordmann");
  await expect(page.getByRole("table")).toContainText(
    "Skjemaet var enkelt å bruke.",
  );
});

test("mobile masking rejects an old selection in another tab and refreshes it", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const other = await context.newPage();
  await openMasking(other, "Kari Hansen");
  await selectName(other, "Kari Hansen");
  await openMasking(page, "Kari Hansen", true);
  await selectName(page, "Kari Hansen");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include("dialog")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("masking-mobile.png") });
  await page
    .getByRole("button", { name: "Masker permanent", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await other
    .getByRole("button", { name: "Masker permanent", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText(
    "Svaret er endret siden du åpnet det",
  );
  await expect(
    other.getByRole("button", { name: "Masker permanent", exact: true }),
  ).toHaveCount(0);
  await other.getByRole("button", { name: "Lukk og oppdater" }).click();
  await expect(other.getByRole("dialog")).toHaveCount(0);
  await expect(other.getByRole("table")).toHaveCount(0);
  await page.goto(surveyUrl);
  await expect(page.getByText("Kari Hansen", { exact: false })).toHaveCount(0);
  await expect(
    page
      .getByText(/Hilsen \[TEKST FJERNET\]/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await other.close();
});
