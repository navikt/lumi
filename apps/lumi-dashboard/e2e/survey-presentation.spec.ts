import AxeBuilder from "@axe-core/playwright";
import {
  type APIResponse,
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from "@playwright/test";

const QUESTION = "Hvor lett var det å bruke kalkulatoren?";
const PLACEMENT = "Under resultatlisten";

async function createDraft(page: Page, name: string) {
  await page.goto("/surveyverksted");
  await page
    .getByLabel("Hva vil dere finne ut?")
    .selectOption({ label: "Noe annet" });
  await page.getByLabel("Navn på utkastet").fill(name);
  await page
    .getByRole("button", { name: "Opprett utkast", exact: true })
    .click();
  await expect(editor(page)).toBeVisible();
}

const editor = (page: Page) =>
  page.getByRole("region", { name: "Rediger spørsmål", exact: true });
const preview = (page: Page) =>
  page.getByRole("region", { name: "Forhåndsvisning", exact: true });
const dock = (scope: Page | Locator) =>
  scope.locator('aside[aria-label="Tilbakemeldingspanel"]');
const inlineSurvey = (scope: Page | Locator) =>
  scope.locator(".lumi-survey-inline");

async function saved(page: Page) {
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
}

async function noAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

const width = (locator: Locator) =>
  locator.evaluate((element) => element.getBoundingClientRect().width);

/** The server function a request calls, read from its id. */
function serverFunction(url: string) {
  const id = new URL(url).pathname.split("/_serverFn/")[1] ?? "";
  try {
    return String(JSON.parse(Buffer.from(id, "base64url").toString()).export);
  } catch {
    return "";
  }
}

/**
 * The payload of a server function without `key` in any object, as a server
 * from before the display choice existed sends and answers it. The payload
 * is seroval's JSON, where an object lists its keys and its values side by
 * side.
 */
function withoutKey(node: unknown, key: string): unknown {
  if (Array.isArray(node)) return node.map((child) => withoutKey(child, key));
  if (!node || typeof node !== "object") return node;
  const copy = Object.fromEntries(
    Object.entries(node).map(([name, value]) => [name, withoutKey(value, key)]),
  );
  const properties = copy.p as { k?: unknown[]; v?: unknown[] } | undefined;
  const index = properties?.k?.indexOf(key) ?? -1;
  if (properties?.k && properties.v && index !== -1) {
    copy.p = {
      ...properties,
      k: properties.k.filter((_, at) => at !== index),
      v: properties.v.filter((_, at) => at !== index),
    };
  }
  return copy;
}

const SAVE_DRAFT = "saveSurveyAuthoringDraftServerFn";
const SHARE_DRAFT = "createSurveyAuthoringRevisionServerFn";
const UNREADABLE =
  "Svaret fra Lumi kunne ikke leses. Endringen kan ha blitt lagret. Last siden på nytt før du prøver igjen.";
const FETCH_DRAFT = "fetchSurveyAuthoringProjectServerFn";
const FETCH_REVISION = "fetchSurveyAuthoringRevisionServerFn";

/**
 * The answer of a server function that failed with `message`, as the page
 * gets it through the serialization. It is made from a real failure: the
 * draft of an id that does not exist.
 */
async function failedAnswer(page: Page, status: number, message: string) {
  let captured: { headers: Record<string, string>; body: string } | undefined;
  await page.route("**/_serverFn/**", async (route) => {
    if (
      captured ||
      !serverFunction(route.request().url()).startsWith(FETCH_DRAFT)
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    captured = { headers: response.headers(), body: await response.text() };
    await route.fulfill({ response, body: captured.body });
  });
  await page.goto(
    "/surveyverksted/00000000-0000-4000-8000-000000000000?team=team-esyfo",
  );
  await expect(page.getByText("Utkastet kunne ikke åpnes.")).toBeVisible();
  await page.unroute("**/_serverFn/**");
  if (!captured?.body.includes("Survey project not found")) {
    throw new Error("No failure to copy");
  }
  const headers = { ...captured.headers };
  delete headers["content-length"];
  delete headers["content-encoding"];
  delete headers["transfer-encoding"];
  return {
    status,
    headers,
    body: captured.body.replace("Survey project not found", message),
  };
}

/** An answer kept to be given again later, as a proxy could. */
async function keptAnswer(response: APIResponse) {
  const headers = { ...response.headers() };
  delete headers["content-length"];
  delete headers["content-encoding"];
  delete headers["transfer-encoding"];
  return { status: response.status(), headers, body: await response.text() };
}

/** The row of the description list on the page of a shared version. */
const fact = (page: Page, term: string) =>
  page
    .getByRole("complementary", { name: "Om versjonen" })
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: term }) })
    .locator("dd");

test("places a survey at the content, previews it and shares it with the developer", async ({
  page,
}) => {
  await createDraft(page, "Kalkulator ved innholdet");
  const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
  await prompt.fill(QUESTION);

  // A new survey is the floating panel, as every survey was before.
  const mode = preview(page).getByRole("radiogroup", { name: "Visning" });
  await expect(
    mode.getByRole("radio", { name: "Flytende panel" }),
  ).toBeChecked();
  await expect(dock(preview(page))).toBeVisible();
  await expect(inlineSurvey(preview(page))).toHaveCount(0);

  // The author moves it to the content. The questions are untouched.
  await mode.getByRole("radio", { name: "Ved innholdet" }).click();
  await expect(inlineSurvey(preview(page))).toBeVisible();
  await expect(dock(preview(page))).toHaveCount(0);
  await expect(preview(page).getByText("Eksempelinnhold")).toBeVisible();
  await expect(prompt).toHaveValue(QUESTION);
  await expect(
    inlineSurvey(preview(page)).getByText(QUESTION).first(),
  ).toBeVisible();

  await preview(page)
    .getByLabel("Plassering i appen (valgfritt)")
    .fill(PLACEMENT);
  await expect(
    preview(page).getByText(`Plassering: ${PLACEMENT}`),
  ).toBeVisible();

  // The preview can be tried in a narrow column and at the width of a phone.
  const widths = preview(page).getByRole("radiogroup", {
    name: "Bredde i forhåndsvisningen",
  });
  await widths.getByRole("radio", { name: "Smal kolonne" }).click();
  await expect
    .poll(() => width(inlineSurvey(preview(page))))
    .toBeCloseTo(256, 0);
  await widths.getByRole("radio", { name: "Mobil" }).click();
  await expect
    .poll(() => width(inlineSurvey(preview(page))))
    .toBeLessThanOrEqual(360);
  const fits = await inlineSurvey(preview(page)).evaluate((survey) => {
    const stage = survey.closest('[class*="stageViewport"]');
    if (!stage) return null;
    const outer = stage.getBoundingClientRect();
    const inner = survey.getBoundingClientRect();
    return inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
  });
  expect(fits).toBe(true);
  await widths.getByRole("radio", { name: "Full bredde" }).click();

  // The choice is saved with the draft.
  await saved(page);
  await page.reload();
  await expect(
    preview(page).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
  await expect(
    preview(page).getByLabel("Plassering i appen (valgfritt)"),
  ).toHaveValue(PLACEMENT);
  await expect(inlineSurvey(preview(page))).toBeVisible();
  await noAxeViolations(page);

  // "Prøv i egen fane" shows the survey the same way.
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const ownTab = await popupPromise;
  await expect(inlineSurvey(ownTab)).toBeVisible();
  await expect(dock(ownTab)).toHaveCount(0);
  await expect(ownTab.getByText("Eksempelinnhold")).toBeVisible();
  await expect(ownTab.getByText(`Plassering: ${PLACEMENT}`)).toBeVisible();
  await expect(inlineSurvey(ownTab).getByText(QUESTION).first()).toBeVisible();
  await noAxeViolations(ownTab);
  await ownTab.close();

  // The shared version tells the developer where the survey belongs.
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);
  const firstVersionUrl = page.url();
  await expect(fact(page, "Visning")).toHaveText("Ved innholdet");
  await expect(fact(page, "Plassering")).toHaveText(PLACEMENT);
  await expect(inlineSurvey(page)).toBeVisible();
  await expect(dock(page)).toHaveCount(0);
  await expect(
    page.getByText(`Plassering: ${PLACEMENT}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("pnpm add @navikt/lumi-survey@^2.6.0", { exact: true }),
  ).toBeVisible();
  const example = page
    .locator("pre")
    .filter({ hasText: "export function Tilbakemelding" });
  await expect(example).toContainText(
    "// Krever @navikt/lumi-survey 2.6.0 eller nyere.",
  );
  await expect(example).toContainText("<LumiSurveyInline");
  await expect(example).toContainText(
    'context={{ tags: { surface: "inline", placement: "under-resultatlisten" } }}',
  );
  await expect(
    page.getByRole("button", { name: "Kopier eksempelet" }),
  ).toBeVisible();
  // The exported document is still a plain SurveyDocumentV1.
  await page.getByText("Se TypeScript-koden").click();
  const document = page
    .locator("pre")
    .filter({ hasText: "satisfies SurveyDocumentV1" });
  await expect(document).not.toContainText("placement");
  await expect(document).not.toContainText("inline");
  await noAxeViolations(page);

  // Moving the survey back is a change the next version shows. The note is
  // about a place at the content: it leaves with the floating panel, and is
  // back if the author chooses the content again.
  await page.getByRole("button", { name: "Rediger utkastet" }).click();
  await expect(editor(page)).toBeVisible();
  const note = preview(page).getByLabel("Plassering i appen (valgfritt)");
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
  await expect(dock(preview(page))).toBeVisible();
  await expect(note).toHaveCount(0);
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect(note).toHaveValue(PLACEMENT);
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
  await expect(dock(preview(page))).toBeVisible();
  await saved(page);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 2", exact: true })
    .click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);
  expect(page.url()).not.toBe(firstVersionUrl);
  await expect(
    page.getByText(
      "Visningen er endret fra «Ved innholdet» til «Flytende panel».",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(`Plasseringsbeskrivelsen «${PLACEMENT}» er fjernet.`),
  ).toBeVisible();
  await expect(fact(page, "Visning")).toHaveText("Flytende panel");
  await expect(fact(page, "Plassering")).toHaveCount(0);
  await expect(dock(page)).toBeVisible();
  await expect(
    page.locator("pre").filter({ hasText: "export function Tilbakemelding" }),
  ).toContainText("<LumiSurveyDock");

  // The first version is as it was shared.
  await page.goto(firstVersionUrl);
  await expect(fact(page, "Visning")).toHaveText("Ved innholdet");
  await expect(inlineSurvey(page)).toBeVisible();
});

test("holds the preview in its own tab back after a conflict, also when the choice is undone", async ({
  page,
  context,
}) => {
  await createDraft(page, "Konflikt om visning");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(page);

  // Another tab chooses the floating panel behind this editor's back.
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(
    preview(other).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
  await preview(other).getByRole("radio", { name: "Flytende panel" }).click();
  await saved(other);
  await other.close();

  // This tab's save meets the newer draft.
  const conflict = page.getByText(/endret i en annen fane/);
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
  await expect(conflict).toBeVisible();
  // With the choice undone the editor shows what it last saved, but the
  // server holds the other tab's draft, which the own tab would show.
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect(inlineSurvey(preview(page))).toBeVisible();
  await expect(conflict).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prøv i egen fane" }),
  ).toBeDisabled();
});

test("says so in its own tab, and holds sharing back, when another tab has saved the draft", async ({
  page,
  context,
}) => {
  await createDraft(page, "Lagret i en annen fane");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // Another tab chooses the content. This tab has nothing unsaved.
  const other = await context.newPage();
  await other.goto(page.url());
  await preview(other).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(other);
  await other.close();

  // The own tab shows what is saved now, and says why it is not what this
  // editor shows.
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const ownTab = await popupPromise;
  await expect(
    ownTab.getByText(
      "Utkastet er lagret på nytt siden lenken til forhåndsvisningen ble laget, kanskje i en annen fane. Forhåndsvisningen viser det som er lagret nå.",
    ),
  ).toBeVisible();
  await expect(inlineSurvey(ownTab)).toBeVisible();
  await ownTab.close();

  // Sharing meets the newer draft, and the editor holds back until reload.
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        "Utkastet er endret et annet sted, for eksempel i en annen fane. Last siden på nytt før du deler.",
      ),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Del versjon 1" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText(
      "Utkastet er endret et annet sted, for eksempel i en annen fane. Last siden på nytt før du fortsetter.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prøv i egen fane" }),
  ).toBeDisabled();
});

test("does not say a draft is saved when the answer to a save was lost on the way", async ({
  page,
}) => {
  await createDraft(page, "Tapt svar");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // The server saves the choice, but the answer never reaches the page.
  let lost = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SAVE_DRAFT) || lost) {
      await route.continue();
      return;
    }
    lost += 1;
    await route.fetch();
    await route.abort("failed");
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect.poll(() => lost).toBe(1);
  // The author goes back to the floating panel, which the editor last saved.
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();

  // The editor sends the draft again, and the server says it has a newer one.
  await expect(
    page.getByText(/Det kan ha blitt endret i en annen fane/),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-state="saved"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prøv i egen fane" }),
  ).toBeDisabled();
});

test("sends the draft again when the connection broke after the server saved it", async ({
  page,
}) => {
  const broken = await failedAnswer(page, 500, "terminated");
  await createDraft(page, "Brutt forbindelse");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // The server saves the choice, and the connection breaks while the
  // dashboard reads the answer from the API.
  let saves = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      await route.continue();
      return;
    }
    saves += 1;
    if (saves === 1) {
      await route.fetch();
      await route.fulfill(broken);
      return;
    }
    await route.continue();
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect.poll(() => saves).toBe(1);
  // The author goes back to the floating panel, which the editor last saved.
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();

  // The editor sends the draft again, and the server says it has a newer one.
  await expect(
    page.getByText(/Det kan ha blitt endret i en annen fane/),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-state="saved"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prøv i egen fane" }),
  ).toBeDisabled();
});

test("does not send a draft again that the server refused to save", async ({
  page,
}) => {
  const refused = await failedAnswer(page, 429, "Too many requests");
  await createDraft(page, "Avvist lagring");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // The server refuses the next save: too many requests.
  let saves = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      await route.continue();
      return;
    }
    saves += 1;
    if (saves === 1) {
      await route.fulfill(refused);
      return;
    }
    await route.continue();
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect.poll(() => saves).toBe(1);
  // The author goes back to the floating panel, which the server holds.
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
  await saved(page);

  // Nothing is sent again. A save of what the server holds would only move
  // its version on, and a shared version would seem to have changes since.
  await page.waitForTimeout(4000);
  expect(saves).toBe(1);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Del versjon 1", exact: true }),
  ).toBeEnabled();
});

test("stops saving and asks for a reload when a save gets a page instead of the draft", async ({
  page,
}) => {
  await createDraft(page, "Svar fra en mellomtjener");
  const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
  await prompt.fill(QUESTION);
  await saved(page);

  // A proxy in front of the dashboard answers the next save with a page of
  // its own, after the save has reached the server.
  let pages = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (
      pages ||
      !serverFunction(route.request().url()).startsWith(SAVE_DRAFT)
    ) {
      await route.continue();
      return;
    }
    pages += 1;
    await route.fetch();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Logg inn</title><p>Logg inn</p>",
    });
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();

  await expect(
    page.getByText(UNREADABLE).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator('[data-state="uncertain"]')).toBeVisible();
  // The draft stays in the editor, and sharing says why it waits.
  await expect(prompt).toHaveValue(QUESTION);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByText(UNREADABLE)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Prøv i egen fane" }),
  ).toBeDisabled();

  // Opened again, the editor shows what the server holds.
  await page.unroute("**/_serverFn/**");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);
  await page
    .getByRole("link", { name: /Svar fra en mellomtjener/ })
    .first()
    .click();
  await expect(
    preview(page).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
  await expect(prompt).toHaveValue(QUESTION);
});

test("stops saving when a save gets an older answer back", async ({ page }) => {
  await createDraft(page, "Gammelt svar på lagring");
  const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
  // The answer to the first save is kept, and given again for the next one
  // without the save reaching the server, as a proxy could.
  let kept: Awaited<ReturnType<typeof keptAnswer>> | undefined;
  let replayed = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      await route.continue();
      return;
    }
    if (!kept) {
      kept = await keptAnswer(await route.fetch());
      await route.fulfill(kept);
      return;
    }
    if (!replayed) {
      replayed += 1;
      await route.fulfill(kept);
      return;
    }
    await route.continue();
  });
  await prompt.fill(QUESTION);
  await saved(page);
  await prompt.fill(`${QUESTION} Svar gjerne kort.`);

  await expect(
    page.getByText(UNREADABLE).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator('[data-state="uncertain"]')).toBeVisible();
  await expect(prompt).toHaveValue(`${QUESTION} Svar gjerne kort.`);
});

test("says that a draft cannot be opened when the answer is another draft", async ({
  page,
}) => {
  await createDraft(page, "Utkast som skal åpnes");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const wanted = page.url();
  await createDraft(page, "Et annet utkast");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const other = page.url();

  // The answer for the other draft is kept, and a proxy gives it for the
  // draft that is opened.
  let kept: Awaited<ReturnType<typeof keptAnswer>> | undefined;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(FETCH_DRAFT)) {
      await route.continue();
      return;
    }
    if (!kept) {
      kept = await keptAnswer(await route.fetch());
    }
    await route.fulfill(kept);
  });
  await page.goto(other);
  await expect(editor(page)).toBeVisible();
  await page.goto(wanted);

  await expect(page.getByText("Utkastet kunne ikke åpnes.")).toBeVisible({
    timeout: 20_000,
  });
});

test("says so when sharing gets a page instead of the version", async ({
  page,
}) => {
  await createDraft(page, "Deling bak en mellomtjener");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const editorUrl = page.url();
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SHARE_DRAFT)) {
      await route.continue();
      return;
    }
    await route.fetch();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Logg inn</title><p>Logg inn</p>",
    });
  });
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();

  await expect(page.getByRole("dialog").getByText(UNREADABLE)).toBeVisible();
  expect(page.url()).toBe(editorUrl);
});

test("opens what the server holds after a conflict when sharing that comes after the author has left", async ({
  page,
  context,
}) => {
  await createDraft(page, "Sen delingskonflikt");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // Another tab chooses the content.
  const other = await context.newPage();
  await other.goto(page.url());
  await preview(other).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(other);
  await other.close();

  // The answer to sharing comes after the author has left the editor.
  let leave!: () => void;
  const left = new Promise<void>((resolve) => {
    leave = resolve;
  });
  let shared = false;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SHARE_DRAFT)) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await left;
    await route.fulfill({ response });
    shared = true;
  });
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Teamets surveys" }),
  ).toBeVisible();
  leave();
  await expect.poll(() => shared).toBe(true);

  await page
    .getByRole("link", { name: /Sen delingskonflikt/ })
    .first()
    .click();
  await expect(
    preview(page).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
});

test("opens what the server holds after leaving with a save whose answer was lost", async ({
  page,
}) => {
  const broken = await failedAnswer(page, 500, "terminated");
  await createDraft(page, "Ute med ukjent lagring");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // The server saves the content, the connection breaks while the answer is
  // read, and the save when the author leaves does not get through.
  let saves = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      await route.continue();
      return;
    }
    saves += 1;
    if (saves === 1) {
      await route.fetch();
      await route.fulfill(broken);
      return;
    }
    await route.abort("failed");
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await expect.poll(() => saves).toBe(1);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await expect(
    page.getByRole("heading", { name: "Teamets surveys" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.unroute("**/_serverFn/**");

  await page
    .getByRole("link", { name: /Ute med ukjent lagring/ })
    .first()
    .click();
  await expect(
    preview(page).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
});

test("lets the author share again after undoing a change the server would not save", async ({
  page,
}) => {
  await createDraft(page, "Angret navn");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // A name longer than the server takes.
  await page.getByRole("button", { name: /Endre navn på utkastet/ }).click();
  const name = page.getByLabel("Navn på utkastet");
  await name.fill("x".repeat(121));
  await expect(page.locator('[data-state="error"]')).toBeVisible({
    timeout: 20_000,
  });
  // Escape puts the saved name back.
  await name.press("Escape");

  await saved(page);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Del versjon 1", exact: true }),
  ).toBeEnabled();
});

test("saves a name with a space at its end once", async ({ page }) => {
  await createDraft(page, "Mellomrom i navnet");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  let saves = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      saves += 1;
    }
    await route.continue();
  });

  // The server keeps the name without the space, as the field does when the
  // author leaves it.
  await page.getByRole("button", { name: /Endre navn på utkastet/ }).click();
  await page.getByLabel("Navn på utkastet").fill("Mellomrom i navnet 2 ");
  await saved(page);
  await page.getByLabel("Navn på utkastet").press("Enter");
  await page.waitForTimeout(2000);

  expect(saves).toBe(1);
});

/**
 * Opens the preview in its own tab with an answer typed in, and lets the next
 * fetch of the draft in that tab get `failure` when the author comes back.
 */
async function ownTabWhoseNextFetchFails(
  page: Page,
  name: string,
  failure: Parameters<Route["fulfill"]>[0],
) {
  await createDraft(page, name);
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const ownTab = await popupPromise;
  const answer = dock(ownTab).getByRole("textbox");
  await answer.fill("Svaret mitt");

  await ownTab.route("**/_serverFn/**", async (route) => {
    if (serverFunction(route.request().url()).startsWith(FETCH_DRAFT)) {
      await route.fulfill(failure);
      return;
    }
    await route.continue();
  });
  await ownTab.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
  return { ownTab, answer };
}

test("keeps what its own tab shows when an error page answers the next fetch", async ({
  page,
}) => {
  const { ownTab, answer } = await ownTabWhoseNextFetchFails(
    page,
    "Egen fane uten nett",
    { status: 500, body: "Feil" },
  );

  await expect(
    ownTab.getByText(
      "Utkastet kunne ikke hentes på nytt. Forhåndsvisningen viser det som ble hentet sist.",
    ),
  ).toBeVisible({ timeout: 20_000 });
  await expect(answer).toHaveValue("Svaret mitt");
  await ownTab.close();
});

test("hides the draft in its own tab when the dashboard refuses the next fetch", async ({
  page,
}) => {
  // The CSRF check in start.ts refuses with plain text.
  const { ownTab } = await ownTabWhoseNextFetchFails(
    page,
    "Egen fane uten tilgang",
    { status: 403, contentType: "text/plain", body: "Forbidden" },
  );

  await expect(
    ownTab.getByText("Kunne ikke hente det lagrede utkastet."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(dock(ownTab)).toHaveCount(0);
  await ownTab.close();
});

test("sends nothing after sharing met a newer draft, and opens what the server holds the next time", async ({
  page,
  context,
}) => {
  await createDraft(page, "Delt mot et nyere utkast");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);

  // Another tab chooses the content.
  const other = await context.newPage();
  await other.goto(page.url());
  await preview(other).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(other);
  await other.close();

  // Sharing meets the newer draft.
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/Utkastet er endret et annet sted/),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // A change here is not sent: it would meet the same conflict.
  let saves = 0;
  await page.route("**/_serverFn/**", async (route) => {
    if (serverFunction(route.request().url()).startsWith(SAVE_DRAFT)) {
      saves += 1;
    }
    await route.continue();
  });
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await page.waitForTimeout(2000);
  expect(saves).toBe(0);

  // Back at what this tab holds, the author leaves and opens the draft
  // again. The editor shows the draft from the other tab.
  await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);
  await page
    .getByRole("link", { name: /Delt mot et nyere utkast/ })
    .first()
    .click();
  await expect(
    preview(page).getByRole("radio", { name: "Ved innholdet" }),
  ).toBeChecked();
  await expect(page.getByText(/endret et annet sted/)).toHaveCount(0);
  await saved(page);
});

test("shows what is saved now when the author comes back to the preview in its own tab", async ({
  page,
}) => {
  await createDraft(page, "Tilbake til egen fane");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const ownTab = await popupPromise;
  await expect(dock(ownTab)).toBeVisible();

  // The author chooses the content in the editor, which saves it.
  await page.bringToFront();
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(page);

  // Back in its own tab. Headless Chromium shows every tab at once, so the
  // test tells the page that it is shown again, as a browser does.
  await ownTab.bringToFront();
  await ownTab.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
  );
  await expect(
    ownTab.getByText(
      "Utkastet er lagret på nytt siden lenken til forhåndsvisningen ble laget, kanskje i en annen fane. Forhåndsvisningen viser det som er lagret nå.",
    ),
  ).toBeVisible();
  await expect(inlineSurvey(ownTab)).toBeVisible();
  await ownTab.close();
});

test("says that a draft cannot be opened when the answer is a page instead of the draft", async ({
  page,
}) => {
  await createDraft(page, "Åpnet bak en mellomtjener");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const editorUrl = page.url();
  const url = new URL(editorUrl);
  const previewUrl = `/survey-preview?team=${url.searchParams.get("team")}&projectId=${url.pathname.split("/").at(-1)}`;

  // A proxy in front of the dashboard answers with a page of its own.
  await page.route("**/_serverFn/**", async (route) => {
    if (!serverFunction(route.request().url()).startsWith(FETCH_DRAFT)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Logg inn</title><p>Logg inn</p>",
    });
  });
  await page.goto(editorUrl);
  await expect(page.getByText("Utkastet kunne ikke åpnes.")).toBeVisible({
    timeout: 20_000,
  });
  await page.goto(previewUrl);
  await expect(
    page.getByText("Kunne ikke hente det lagrede utkastet."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Visningsvalget kunne ikke hentes/)).toHaveCount(
    0,
  );
});

test("links the summary to the version it shows, also after moving between versions", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await createDraft(page, "Lenke til riktig versjon");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await saved(page);
  const share = async (number: number) => {
    await page
      .getByRole("button", { name: "Del med utvikler", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Del versjon ${number}`, exact: true })
      .click();
    await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);
  };
  await share(1);
  const firstUrl = page.url();
  await page.getByRole("button", { name: "Rediger utkastet" }).click();
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(page);
  await share(2);
  const secondUrl = page.url();

  // Version 2 opened anew, then to version 1 and back with the list of
  // versions on the page. Version 2 is loaded by then, so its page is not
  // made anew.
  await page.goto(secondUrl);
  await expect(fact(page, "Visning")).toHaveText("Ved innholdet");
  await page.getByRole("link", { name: "Versjon 1", exact: true }).click();
  await expect(page).toHaveURL(firstUrl);
  await expect(fact(page, "Visning")).toHaveText("Flytende panel");
  await page.getByRole("link", { name: "Versjon 2", exact: true }).click();
  await expect(page).toHaveURL(secondUrl);
  await expect(fact(page, "Visning")).toHaveText("Ved innholdet");

  await page
    .getByRole("button", { name: "Kopier lenke og sammendrag" })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(new URL(secondUrl).pathname);
  expect(copied).not.toContain(new URL(firstUrl).pathname);
});

test("offers the display choice in the detailed editor too", async ({
  page,
}) => {
  await createDraft(page, "Detaljert editor ved innholdet");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await page.getByText("Avanserte innstillinger", { exact: true }).click();
  await page.getByRole("button", { name: "Åpne avansert redigering" }).click();
  const stage = page.getByLabel("Forhåndsvisning");

  await expect(dock(stage)).toBeVisible();
  // The choice can be made with the keyboard alone.
  await stage.getByRole("radio", { name: "Flytende panel" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");

  await expect(inlineSurvey(stage)).toBeVisible();
  await expect(dock(stage)).toHaveCount(0);
  await expect(stage.getByText("Eksempelinnhold")).toBeVisible();
  await saved(page);
  await noAxeViolations(page);
});

test("wraps a long placement note at phone width, in the preview and in its own tab", async ({
  page,
}) => {
  // One word of 150 characters, as long as a note can be in one word.
  const longWord = "resultatlisten".repeat(11).slice(0, 150);
  await createDraft(page, "Langt ord på mobil");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await preview(page)
    .getByLabel("Plassering i appen (valgfritt)")
    .fill(longWord);
  await preview(page)
    .getByRole("radiogroup", { name: "Bredde i forhåndsvisningen" })
    .getByRole("radio", { name: "Mobil" })
    .click();
  /** True when the line with the note is no wider than its box. */
  const wraps = (scope: Page | Locator) =>
    scope
      .getByText(longWord)
      .evaluate((line) => line.scrollWidth <= line.clientWidth + 1);
  await expect.poll(() => wraps(preview(page))).toBe(true);
  await saved(page);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const ownTab = await popupPromise;
  await ownTab.setViewportSize({ width: 360, height: 740 });
  await expect(ownTab.getByText(longWord)).toBeVisible();
  expect(await wraps(ownTab)).toBe(true);
  // Nothing sticks out of the page at the side.
  expect(
    await ownTab.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await ownTab.close();
});

test("wraps a long placement note in what changed, on a shared version at phone width", async ({
  page,
}) => {
  const longWord = "resultatlisten".repeat(11).slice(0, 150);
  await createDraft(page, "Langt ord i endringene");
  await editor(page)
    .getByLabel("Spørsmålstekst", { exact: true })
    .fill(QUESTION);
  await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
  await saved(page);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 1", exact: true })
    .click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);

  await page.getByRole("button", { name: "Rediger utkastet" }).click();
  await preview(page)
    .getByLabel("Plassering i appen (valgfritt)")
    .fill(longWord);
  await saved(page);
  await page
    .getByRole("button", { name: "Del med utvikler", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Del versjon 2", exact: true })
    .click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);

  await page.setViewportSize({ width: 360, height: 740 });
  const change = page
    .getByRole("listitem")
    .filter({ hasText: `Plasseringsbeskrivelsen «${longWord}» er lagt til.` });
  await expect(change).toBeVisible();
  // The whole change can be read: nothing sticks out of its box, and the box
  // is inside the screen.
  expect(
    await change.evaluate(
      (item) =>
        item.scrollWidth <= item.clientWidth + 1 &&
        item.getBoundingClientRect().right <=
          document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test.describe("while a new version of Lumi is rolled out", () => {
  test("saves the draft from a page that was open before the choice existed, and keeps the choice", async ({
    page,
  }) => {
    await createDraft(page, "Lagret fra en gammel side");
    const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
    await prompt.fill(QUESTION);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await preview(page)
      .getByLabel("Plassering i appen (valgfritt)")
      .fill(PLACEMENT);
    await saved(page);

    // Such a page saves the draft without the choice.
    const statuses: number[] = [];
    await page.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (!serverFunction(request.url()).startsWith(SAVE_DRAFT)) {
        await route.continue();
        return;
      }
      const payload = JSON.parse(request.postData() ?? "null");
      const response = await route.fetch({
        postData: JSON.stringify(withoutKey(payload, "presentation")),
      });
      statuses.push(response.status());
      await route.fulfill({ response });
    });
    await prompt.fill(`${QUESTION} Svar gjerne kort.`);
    await saved(page);
    expect(statuses).toEqual([200]);

    await page.unroute("**/_serverFn/**");
    await page.reload();
    await expect(prompt).toHaveValue(`${QUESTION} Svar gjerne kort.`);
    await expect(
      preview(page).getByRole("radio", { name: "Ved innholdet" }),
    ).toBeChecked();
    await expect(
      preview(page).getByLabel("Plassering i appen (valgfritt)"),
    ).toHaveValue(PLACEMENT);
  });

  test("does not say the choice is saved when a server from before it left the choice out", async ({
    page,
  }) => {
    await createDraft(page, "Lagret på en gammel server");
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(QUESTION);
    await saved(page);

    // Every save reaches a server from before the choice existed. It leaves
    // the choice out of its request to the API, which keeps the one it had.
    const leftOut: string[] = [];
    await page.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (!serverFunction(request.url()).startsWith(SAVE_DRAFT)) {
        await route.continue();
        return;
      }
      leftOut.push(request.postData() ?? "");
      const payload = JSON.parse(request.postData() ?? "null");
      await route.continue({
        postData: JSON.stringify(withoutKey(payload, "presentation")),
      });
    });
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();

    // The editor tries again a few times, then says what was not saved.
    const notSaved = page.getByText(
      "Visningsvalget ble ikke lagret. Resten av utkastet er lagret. Prøv igjen om litt.",
      { exact: true },
    );
    await expect(notSaved).toBeVisible({ timeout: 20_000 });
    expect(leftOut).toHaveLength(3);
    await expect(page.locator('[data-state="saved"]')).toHaveCount(0);

    // A change to the rest of the draft is still saved, so the message
    // stays true.
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(`${QUESTION} Svar gjerne kort.`);
    await expect.poll(() => leftOut.length).toBe(4);
    expect(leftOut[3]).toContain("Svar gjerne kort.");
    await expect(notSaved).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Prøv i egen fane" }),
    ).toBeDisabled();
    // Sharing waits for the choice too: the version would get the old one.
    await page
      .getByRole("button", { name: "Del med utvikler", exact: true })
      .click();
    await expect(
      page.getByText(
        "Utkastet får ikke lagret: visningsvalget ble ikke lagret. Deling krever at endringene er lagret.",
      ),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // The new version is out, and the next save keeps the choice.
    await page.unroute("**/_serverFn/**");
    await page.getByRole("button", { name: "Prøv å lagre igjen" }).click();
    await saved(page);
    await expect(notSaved).toHaveCount(0);
    await page.reload();
    await expect(
      preview(page).getByRole("radio", { name: "Ved innholdet" }),
    ).toBeChecked();
    await expect(
      editor(page).getByLabel("Spørsmålstekst", { exact: true }),
    ).toHaveValue(`${QUESTION} Svar gjerne kort.`);
  });

  /** Every save from now on reaches a server from before the choice. */
  const leaveTheChoiceOut = (page: Page) =>
    page.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (!serverFunction(request.url()).startsWith(SAVE_DRAFT)) {
        await route.continue();
        return;
      }
      await route.continue({
        postData: JSON.stringify(
          withoutKey(JSON.parse(request.postData() ?? "null"), "presentation"),
        ),
      });
    });
  const choiceNotSaved = (page: Page) =>
    page.getByText(
      "Visningsvalget ble ikke lagret. Resten av utkastet er lagret. Prøv igjen om litt.",
      { exact: true },
    );

  test("lets the author share again when going back to the choice that is saved", async ({
    page,
  }) => {
    await createDraft(page, "Tilbake til det lagrede valget");
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(QUESTION);
    await saved(page);
    await leaveTheChoiceOut(page);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await expect(choiceNotSaved(page)).toBeVisible({ timeout: 20_000 });

    // The floating panel is what the server holds.
    await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
    await expect(choiceNotSaved(page)).toHaveCount(0);
    await saved(page);
    await page
      .getByRole("button", { name: "Del med utvikler", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Del versjon 1", exact: true }),
    ).toBeEnabled();
  });

  test("lets the author share again when going back to a saved note with a space at its end", async ({
    page,
  }) => {
    await createDraft(page, "Mellomrom i plasseringen");
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(QUESTION);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    const note = preview(page).getByLabel("Plassering i appen (valgfritt)");
    // The API stores the note without the space at its end.
    await note.fill("Under listen ");
    await saved(page);
    await leaveTheChoiceOut(page);
    await preview(page).getByRole("radio", { name: "Flytende panel" }).click();
    await expect(choiceNotSaved(page)).toBeVisible({ timeout: 20_000 });

    // Back at the content, the note is the one the server holds.
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await expect(note).toHaveValue("Under listen ");
    await expect(choiceNotSaved(page)).toHaveCount(0);
    await saved(page);
    await page
      .getByRole("button", { name: "Del med utvikler", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Del versjon 1", exact: true }),
    ).toBeEnabled();
  });

  test("does not say that the rest is saved while a change to it cannot be", async ({
    page,
  }) => {
    await createDraft(page, "Mangler survey-ID");
    const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
    await prompt.fill(QUESTION);
    await saved(page);
    await leaveTheChoiceOut(page);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await expect(choiceNotSaved(page)).toBeVisible({ timeout: 20_000 });

    // Without a survey id nothing is saved.
    await page
      .getByRole("button", { name: "Innstillinger for utkastet" })
      .click();
    await page.getByLabel("Foreslått survey-ID").fill("");
    await page.keyboard.press("Escape");
    await prompt.fill(`${QUESTION} Svar gjerne kort.`);

    await expect(choiceNotSaved(page)).toHaveCount(0);
    await expect(
      page.getByText(
        "Visningsvalget ble ikke lagret, og utkastet mangler navn eller survey-ID. De siste endringene lagres når det er rettet.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  for (const [from, to] of [
    ["Ved innholdet", "Flytende panel"],
    ["Flytende panel", "Ved innholdet"],
  ] as const) {
    test(`does not say a change from ${from} to ${to} is saved when an API from before the choice answered`, async ({
      page,
    }) => {
      await createDraft(page, `Fra ${from} på et gammelt API`);
      await editor(page)
        .getByLabel("Spørsmålstekst", { exact: true })
        .fill(QUESTION);
      await preview(page).getByRole("radio", { name: from }).click();
      await saved(page);

      // A rolled back API answers every save. It does not know the choice:
      // it keeps the stored one and sends none back.
      const sent: string[] = [];
      await page.route("**/_serverFn/**", async (route) => {
        const request = route.request();
        if (!serverFunction(request.url()).startsWith(SAVE_DRAFT)) {
          await route.continue();
          return;
        }
        sent.push(request.postData() ?? "");
        const response = await route.fetch({
          postData: JSON.stringify(
            withoutKey(
              JSON.parse(request.postData() ?? "null"),
              "presentation",
            ),
          ),
        });
        await route.fulfill({
          response,
          body: JSON.stringify(
            withoutKey(JSON.parse(await response.text()), "presentation"),
          ),
        });
      });
      await preview(page).getByRole("radio", { name: to }).click();

      await expect(
        page.getByText(
          "Visningsvalget ble ikke lagret. Resten av utkastet er lagret. Prøv igjen om litt.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 20_000 });
      // Every try sends the choice: the editor still knows the stored one.
      expect(sent).toHaveLength(3);
      for (const request of sent) expect(request).toContain('"presentation"');
      await expect(page.locator('[data-state="saved"]')).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Prøv i egen fane" }),
      ).toBeDisabled();

      await page.unroute("**/_serverFn/**");
      await page.reload();
      await expect(
        preview(page).getByRole("radio", { name: from }),
      ).toBeChecked();
    });
  }

  test("saves the choice on the next try when only one save reached an old server", async ({
    page,
  }) => {
    await createDraft(page, "Én gammel server");
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(QUESTION);
    await saved(page);

    let leftOut = 0;
    await page.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (!serverFunction(request.url()).startsWith(SAVE_DRAFT) || leftOut) {
        await route.continue();
        return;
      }
      leftOut += 1;
      const payload = JSON.parse(request.postData() ?? "null");
      await route.continue({
        postData: JSON.stringify(withoutKey(payload, "presentation")),
      });
    });
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();

    await saved(page);
    expect(leftOut).toBe(1);
    await page.unroute("**/_serverFn/**");
    await page.reload();
    await expect(
      preview(page).getByRole("radio", { name: "Ved innholdet" }),
    ).toBeChecked();
  });

  test("leaves a choice it could not read alone when the draft is saved", async ({
    page,
  }) => {
    await createDraft(page, "Lest fra et gammelt API");
    const prompt = editor(page).getByLabel("Spørsmålstekst", { exact: true });
    await prompt.fill(QUESTION);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await preview(page)
      .getByLabel("Plassering i appen (valgfritt)")
      .fill(PLACEMENT);
    await saved(page);

    // An API from before the choice existed answers when the draft is
    // opened, and sends no presentation.
    await page.route("**/_serverFn/**", async (route) => {
      if (!serverFunction(route.request().url()).startsWith(FETCH_DRAFT)) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const payload = JSON.parse(await response.text());
      await route.fulfill({
        response,
        body: JSON.stringify(withoutKey(payload, "presentation")),
      });
    });
    const saves: string[] = [];
    page.on("request", (request) => {
      if (serverFunction(request.url()).startsWith(SAVE_DRAFT)) {
        saves.push(request.postData() ?? "");
      }
    });
    await page.reload();

    await expect(
      preview(page).getByText(
        "Visningsvalget kunne ikke hentes, så forhåndsvisningen viser flytende panel. Last siden på nytt for å se og endre valget.",
      ),
    ).toBeVisible();
    await expect(
      preview(page).getByRole("radiogroup", { name: "Visning" }),
    ).toHaveCount(0);
    await expect(dock(preview(page))).toBeVisible();

    // The author changes the question. The save leaves the choice alone.
    await prompt.fill(`${QUESTION} Svar gjerne kort.`);
    await saved(page);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toContain("Svar gjerne kort.");
    expect(saves[0]).not.toContain('"presentation"');

    // The new API answered the save with the stored choice. The page still
    // shows the floating panel in its place, so the next save leaves the
    // choice alone too.
    await expect(
      preview(page).getByRole("radiogroup", { name: "Visning" }),
    ).toHaveCount(0);
    await prompt.fill(`${QUESTION} Svar gjerne kort og presist.`);
    await saved(page);
    expect(saves).toHaveLength(2);
    expect(saves[1]).toContain("Svar gjerne kort og presist.");
    expect(saves[1]).not.toContain('"presentation"');

    await page.unroute("**/_serverFn/**");
    await page.reload();
    await expect(prompt).toHaveValue(
      `${QUESTION} Svar gjerne kort og presist.`,
    );
    await expect(
      preview(page).getByRole("radio", { name: "Ved innholdet" }),
    ).toBeChecked();
    await expect(
      preview(page).getByLabel("Plassering i appen (valgfritt)"),
    ).toHaveValue(PLACEMENT);
  });

  test("says on a shared version and in its own tab that a choice it could not read is not known", async ({
    page,
    context,
  }) => {
    await createDraft(page, "Delt fra et gammelt API");
    await editor(page)
      .getByLabel("Spørsmålstekst", { exact: true })
      .fill(QUESTION);
    await preview(page).getByRole("radio", { name: "Ved innholdet" }).click();
    await preview(page)
      .getByLabel("Plassering i appen (valgfritt)")
      .fill(PLACEMENT);
    await saved(page);
    await page
      .getByRole("button", { name: "Del med utvikler", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Del versjon 1", exact: true })
      .click();
    await expect(page).toHaveURL(/\/surveyverksted\/revisions\//);
    await expect(fact(page, "Visning")).toHaveText("Ved innholdet");

    // An API from before the choice existed answers, with no presentation.
    await context.route("**/_serverFn/**", async (route) => {
      const name = serverFunction(route.request().url());
      if (!name.startsWith(FETCH_REVISION) && !name.startsWith(FETCH_DRAFT)) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: JSON.stringify(
          withoutKey(JSON.parse(await response.text()), "presentation"),
        ),
      });
    });
    await page.reload();

    await expect(
      page.getByText(
        "Visningsvalget kunne ikke hentes, så forhåndsvisningen viser flytende panel. Last siden på nytt for å se valget.",
      ),
    ).toBeVisible();
    await expect(fact(page, "Visning")).toHaveText("Kunne ikke hentes");
    await expect(fact(page, "Plassering")).toHaveCount(0);
    // No example tells the developer to use the floating panel.
    await expect(
      page.getByText(
        "Visningsvalget kunne ikke hentes, så eksempelet for appen vises ikke. Last siden på nytt for å se det.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Slik viser appen surveyen" }),
    ).toHaveCount(0);
    await expect(page.getByText(/pnpm add @navikt\/lumi-survey/)).toHaveCount(
      0,
    );
    // The document itself can still be taken into the app.
    await expect(
      page.getByRole("button", { name: "Kopier TypeScript" }),
    ).toBeVisible();
    await noAxeViolations(page);

    await page.getByRole("button", { name: "Rediger utkastet" }).click();
    await expect(editor(page)).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Prøv i egen fane" }).click();
    const ownTab = await popupPromise;
    await expect(
      ownTab.getByText(
        "Visningsvalget kunne ikke hentes, så forhåndsvisningen viser flytende panel. Last siden på nytt for å se valget.",
      ),
    ).toBeVisible();
    await expect(dock(ownTab)).toBeVisible();
    await ownTab.close();
  });
});
