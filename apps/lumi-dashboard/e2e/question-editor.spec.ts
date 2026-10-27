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
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

test("previews every page while building and keeps the outline on the page shown", async ({
  page,
}) => {
  await createDraft(page, "Forhåndsvis alle sidene");
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
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill("Hva ble dere enige om?");
  await editor(page)
    .getByRole("button", { name: "Legg til spørsmål", exact: true })
    .click();
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill("Er det noe mer du vil si?");
  await saved(page);

  const outlineQuestion = (name: string) =>
    page
      .getByRole("navigation", { name: "Spørsmål og sider i undersøkelsen" })
      .getByRole("button", { name })
      .last();
  const prompt = () =>
    editor(page).getByLabel("Spørsmålstekst", { exact: true });
  const next = () =>
    preview(page).getByRole("button", { name: "Neste", exact: true });
  const back = () =>
    preview(page).getByRole("button", { name: "Tilbake", exact: true });
  const send = () =>
    preview(page).getByRole("button", { name: "Send", exact: true });
  const focusInPreview = () =>
    page.evaluate(() =>
      Boolean(
        document.activeElement?.closest('[aria-label="Forhåndsvisning"]'),
      ),
    );

  const previewTop = () =>
    preview(page).evaluate((element) =>
      Math.round(element.getBoundingClientRect().top),
    );
  const textbox = (name: RegExp) =>
    preview(page).getByRole("textbox", { name });

  await outlineQuestion("Spørsmål 1 · Har du gjennomført dialogmøte?").click();
  await expect(
    preview(page).getByRole("heading", { name: "Forhåndsvis sidene" }),
  ).toBeVisible();
  // The follow-up shows whatever the answer, since conditions are left out.
  const no = preview(page).getByRole("radio", {
    name: "Nei, ikke gjennomført",
    exact: true,
  });
  await expect(no).toBeVisible();
  await expect(send()).toHaveCount(0);
  await no.check();
  // At 1280 px the preview sits below the editor, which changes height when
  // the outline follows. The preview must stay where the author clicked.
  await next().scrollIntoViewIfNeeded();
  const top = await previewTop();
  await next().click();
  await expect(textbox(/Hva ble dere enige om/)).toBeVisible();
  await expect(prompt()).toHaveValue("Hva ble dere enige om?");
  await expect(
    outlineQuestion("Spørsmål 2 · Hva ble dere enige om?"),
  ).toHaveAttribute("aria-current", "step");
  expect(await previewTop()).toBe(top);
  await expect.poll(focusInPreview).toBe(true);
  await expect(send()).toHaveCount(0);
  await next().click();
  await expect(textbox(/Er det noe mer du vil si/)).toBeVisible();
  await expect(prompt()).toHaveValue("Er det noe mer du vil si?");
  await expect(next()).toHaveCount(0);

  // Going back keeps the answers, and the outline follows.
  await back().click();
  await back().click();
  await expect(no).toBeChecked();
  await expect(prompt()).toHaveValue("Har du gjennomført dialogmøte?");
  await next().click();
  await next().click();
  await send().click();
  await expect(
    preview(page).getByRole("heading", { name: "Takk for svaret" }),
  ).toBeVisible();
  await expect(preview(page).getByText("Ingen svar ble sendt.")).toBeVisible();
  await noAxeViolations(page);

  // «Start på nytt» and closing the dock both start on the author's page.
  await preview(page)
    .getByRole("button", { name: "Start på nytt", exact: true })
    .click();
  await expect(textbox(/Er det noe mer du vil si/)).toBeVisible();
  await preview(page)
    .getByRole("button", { name: "Lukk", exact: true })
    .first()
    .click();
  await preview(page)
    .getByRole("button", { name: "Gi tilbakemelding", exact: true })
    .click();
  await expect(textbox(/Er det noe mer du vil si/)).toBeVisible();
  await expect(prompt()).toHaveValue("Er det noe mer du vil si?");

  // Choosing a page in the outline starts the preview there.
  await outlineQuestion("Spørsmål 2 · Hva ble dere enige om?").click();
  await expect(textbox(/Hva ble dere enige om/)).toBeVisible();
  await expect(back()).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await next().click();
  await expect(prompt()).toHaveValue("Er det noe mer du vil si?");
  await expect(send()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await noAxeViolations(page);
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
