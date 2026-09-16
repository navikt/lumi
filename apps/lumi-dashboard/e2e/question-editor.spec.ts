import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function createDraft(page: Page, name: string) {
  await page.goto("/surveyverksted");
  await page
    .getByLabel("Hva vil dere finne ut?")
    .selectOption({ label: "Noe annet" });
  await page.getByLabel("Navn på utkastet").fill(name);
  await page
    .getByRole("button", { name: "Opprett utkast", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Rediger spørsmål", exact: true }),
  ).toBeVisible();
}

const editor = (page: Page) =>
  page.getByRole("region", { name: "Rediger spørsmål", exact: true });
const preview = (page: Page) =>
  page.getByRole("region", { name: "Forhåndsvisning", exact: true });

async function chooseType(page: Page, label: string) {
  await editor(page)
    .getByLabel("Hvordan skal de svare?")
    .selectOption({ label });
}

async function setChoice(page: Page, prompt: string, options: string[]) {
  await editor(page).getByLabel("Spørsmålstekst", { exact: true }).fill(prompt);
  await chooseType(page, "Velg ett svar");
  for (const [index, label] of options.entries()) {
    if (index > 1)
      await editor(page)
        .getByRole("button", { name: "Legg til svaralternativ", exact: true })
        .click();
    await editor(page)
      .getByLabel(`Alternativ ${index + 1}`, { exact: true })
      .fill(label);
  }
}

async function saved(page: Page) {
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
}

async function noAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

test("builds, saves, tries and shares questions with answer-dependent pages", async ({
  page,
}) => {
  await createDraft(page, "Enkel editor med oppfølging");
  await setChoice(page, "Har du gjennomført dialogmøte?", [
    "Ja, gjennomført",
    "Nei, ikke gjennomført",
  ]);
  await editor(page)
    .getByRole("button", {
      name: "Legg til oppfølgingsspørsmål for: Ja, gjennomført",
      exact: true,
    })
    .click();
  await setChoice(page, "Bidro møtet til en plan?", [
    "Ikke i det hele tatt",
    "I liten grad",
    "I noen grad",
    "I stor grad",
    "I svært stor grad",
    "Vet ikke",
  ]);
  await expect(
    page.getByRole("region", { name: "Side 2", exact: true }),
  ).toContainText("Bidro møtet til en plan?");
  await expect(
    editor(page).getByRole("radio", { name: "På en egen side", exact: true }),
  ).toBeChecked();

  await page.getByRole("button", { name: "Velkomstside", exact: true }).click();
  await page.getByRole("checkbox", { name: /velkomstside/i }).check();
  await page
    .getByLabel("Tittel på velkomstsiden", { exact: true })
    .fill("Dine erfaringer med dialogmøte");
  await page
    .getByLabel("Tekst på velkomstsiden", { exact: true })
    .fill("Undersøkelsen tar to minutter.");
  await page.getByRole("button", { name: "Takkeside", exact: true }).click();
  const customize = page.getByRole("button", {
    name: "Tilpass takkesiden",
    exact: true,
  });
  if (await customize.isVisible()) await customize.click();
  await page
    .getByLabel("Tittel på takkesiden", { exact: true })
    .fill("Takk for erfaringene dine");
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "Velkomstside", exact: true }).click();
  await expect(
    page.getByLabel("Tittel på velkomstsiden", { exact: true }),
  ).toHaveValue("Dine erfaringer med dialogmøte");

  await page
    .getByRole("button", { name: "Prøv hele undersøkelsen", exact: true })
    .click();
  await preview(page)
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await preview(page)
    .getByRole("radio", { name: "Ja, gjennomført", exact: true })
    .check();
  await preview(page)
    .getByRole("button", { name: "Neste", exact: true })
    .click();
  await expect(
    preview(page).getByRole("heading", { name: /Bidro møtet til en plan/ }),
  ).toBeVisible();
  await expect(preview(page).getByRole("radio")).toHaveCount(6);
  await expect(preview(page).getByRole("progressbar")).toHaveCount(0);
  await expect(
    preview(page).getByText("Steg 2", { exact: true }),
  ).toBeVisible();
  const dimensions = await preview(page)
    .locator('[class*="stageViewport"]')
    .evaluate((element) => {
      const panel = element.querySelector('[id$="dock-panel"]');
      return {
        height: element.clientHeight,
        scrolls: panel
          ? [...panel.querySelectorAll("*")].filter(
              (child) =>
                child.scrollHeight > child.clientHeight + 2 &&
                ["auto", "scroll"].includes(getComputedStyle(child).overflowY),
            ).length
          : -1,
      };
    });
  expect(dimensions.height).toBeGreaterThanOrEqual(648);
  expect(dimensions.scrolls).toBe(0);
  await preview(page)
    .getByRole("button", { name: "Tilbake", exact: true })
    .click();
  await preview(page)
    .getByRole("radio", { name: "Nei, ikke gjennomført", exact: true })
    .check();
  await expect(
    preview(page).getByRole("button", { name: "Neste", exact: true }),
  ).toHaveCount(0);
  await preview(page)
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await expect(
    preview(page).getByRole("heading", { name: "Takk for erfaringene dine" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tilbake til bygging", exact: true })
    .click();
  await noAxeViolations(page);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);
});

test("groups questions, undoes deletion and works on narrow screens", async ({
  page,
}) => {
  await createDraft(page, "Grupper og rekkefølge");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill("Første spørsmål");
  await editor(page)
    .getByRole("button", { name: "Legg til spørsmål", exact: true })
    .click();
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill("Andre spørsmål");
  await editor(page)
    .getByRole("radio", { name: "Sammen med spørsmål 1", exact: true })
    .check();
  await expect(
    page.getByRole("region", { name: "Side 1", exact: true }),
  ).toContainText("2 spørsmål");
  await expect(
    page.getByRole("region", { name: "Side 2", exact: true }),
  ).toHaveCount(0);
  await editor(page)
    .getByRole("button", { name: "Handlinger", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Slett spørsmål", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Spørsmål 2 · Andre spørsmål/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Angre", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Spørsmål 2 · Andre spørsmål/ }),
  ).toBeVisible();
  await noAxeViolations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Spørsmål og sider", { exact: true }).click();
  await page.getByRole("button", { name: "Velkomstside", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /velkomstside/i }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await noAxeViolations(page);
});
