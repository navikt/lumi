import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Any field whose edits persist to the draft. The seeded question prompt is
 * always present, unlike the now opt-in group heading, and it is the field
 * authors actually type in.
 */
function draftField(target: import("@playwright/test").Page) {
  return target.getByRole("textbox", { name: "Spørsmålstekst" }).first();
}

async function expectNoAxeViolations(page: import("@playwright/test").Page) {
  // Let open/close transitions settle so axe measures final colors.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    ).catch(() => {}),
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
}

test("creates, edits, previews and shares a survey draft", async ({ page }) => {
  await page.goto("/surveyverksted");

  await page.getByLabel("Navn på utkastet").fill("E2E surveyutkast");
  await expect(page.getByLabel("Foreslått survey-ID")).toHaveValue(
    "e2e-surveyutkast",
  );
  await page.getByLabel("Foreslått survey-ID").fill("e2e-survey-v1");
  await page.getByRole("button", { name: "Opprett utkast" }).click();

  await expect(page).toHaveURL(/\/surveyverksted\/[0-9a-f-]+\?team=team-esyfo/);
  await expect(
    page.getByRole("heading", { name: /E2E surveyutkast/ }),
  ).toBeVisible();

  // The group heading is opt-in — a page only gets one when the author asks.
  await page
    .getByRole("button", { name: "Legg til felles overskrift" })
    .click();
  const pageTitle = page.getByLabel("Felles overskrift");
  await pageTitle.fill("Detaljer om opplevelsen");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  await page.reload();
  await expect(pageTitle).toHaveValue("Detaljer om opplevelsen");

  // The living mirror renders the real widget with the page content
  await expect(
    page
      .getByLabel("Forhåndsvisning")
      .getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).toBeVisible();

  // A new page seeds a blank placeholder question, so the rail falls back
  // to naming the page by its number until a prompt or title is written.
  await page.getByRole("button", { name: "Ny side" }).click();
  await expect(page.getByRole("button", { name: /02 Side 2/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Writing the placeholder's prompt gives the page its rail name — and
  // clears the handoff warning so the draft can be shared below.
  await page
    .getByRole("textbox", { name: "Spørsmålstekst" })
    .fill("Hvordan gikk det?");
  await expect(
    page.getByRole("button", { name: /02 Hvordan gikk det\?/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // Add a choice question from the type gallery
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByRole("menuitem", { name: /Enkeltvalg/ }).click();
  const optionOne = page.getByRole("textbox", {
    name: "Alternativ 1",
    exact: true,
  });
  await expect(optionOne).toHaveValue("Alternativ 1");
  await optionOne.fill("Søke om støtte");
  // The analytics identity stays stable while the label changes
  await expect(
    page.getByRole("button", { name: /Endre verdi for alternativ 1/ }),
  ).toHaveText("alternativ-1");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  await expectNoAxeViolations(page);

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const preview = await previewPromise;

  await expect(
    preview.getByText("Svar sendes ikke eller lagres."),
  ).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).toBeVisible();
  const progress = preview.getByRole("progressbar", {
    name: "Fremdrift i undersøkelsen",
  });
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuetext", "Steg 1 av 2");
  await preview.close();

  // Share via the release dialog
  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await expect(page.getByText("Klar til å dele versjon 1")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Del versjon 1" }).click();

  await expect(page).toHaveURL(
    /\/surveyverksted\/revisions\/[0-9a-f-]+\?team=team-esyfo/,
  );
  await expect(page.getByText("Delt versjon", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Klar til bruk" }),
  ).toBeVisible();
  await expect(
    page.getByText("Første delte versjon i prosjektet."),
  ).toBeVisible();

  // The frozen revision is interactive right on the page
  await expect(
    page.getByRole("heading", { name: "Detaljer om opplevelsen" }),
  ).toBeVisible();

  await page.getByText("Tekniske detaljer").click();
  await expect(page.getByText("documentHash")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kopier TypeScript" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Bytt til mørk modus" }).click();
  await expectNoAxeViolations(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Last ned JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-survey-v1-revision-1.json");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Ta surveyen inn i appen" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
    )
    .toBe(true);

  // The embedded dock must stay inside the stage even on narrow windows.
  const dock = page.locator('aside[aria-label="Tilbakemeldingspanel"]');
  await expect(dock).toBeVisible();
  const boxes = await dock.evaluate((element) => {
    const stage = element.closest('[class*="stageViewport"]');
    if (!stage) return null;
    return {
      dock: element.getBoundingClientRect().toJSON(),
      stage: stage.getBoundingClientRect().toJSON(),
    };
  });
  expect(boxes).not.toBeNull();
  if (boxes) {
    expect(boxes.dock.left).toBeGreaterThanOrEqual(boxes.stage.left - 1);
    expect(boxes.dock.right).toBeLessThanOrEqual(boxes.stage.right + 1);
    expect(boxes.dock.bottom).toBeLessThanOrEqual(boxes.stage.bottom + 1);
  }
  await expectNoAxeViolations(page);
});

test("starts a verified specialized survey from plain-language choices", async ({
  page,
}) => {
  await page.goto("/surveyverksted");

  const template = page.getByLabel("Hva vil dere finne ut?");
  await template.selectOption("discovery");
  await expect(
    page.getByText(
      "Finner oppgaven, om brukeren lyktes og hva som eventuelt hindret hen.",
    ),
  ).toBeVisible();

  await page.getByLabel("Navn på utkastet").fill("E2E discoverymal");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  await expect(draftField(page)).toHaveValue(
    "Hva kom du hit for å gjøre i dag?",
  );
  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await expect(page.getByText("Klar til å dele versjon 1")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Del versjon 1" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", { name: "Klar til bruk" }),
  ).toBeVisible();
});

test("turns a Top Tasks example into a protected, shareable analysis", async ({
  page,
}, testInfo) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Hva vil dere finne ut?").selectOption("topTasks");
  await page
    .getByLabel("Navn på utkastet")
    .fill(`E2E top tasks ${testInfo.workerIndex}-${Date.now()}`);
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  const firstTask = page.getByRole("textbox", {
    name: "Alternativ 1",
    exact: true,
  });
  await firstTask.fill("Sende søknad");
  await firstTask.press("Tab");
  await expect(
    page.getByRole("button", { name: /endre verdi for alternativ 1/i }),
  ).toHaveText("sende-soknad");
  await expect(
    page.getByRole("checkbox", { name: "Må besvares" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Slett spørsmålet" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Handlinger for side 1" }).click();
  await expect(
    page.getByRole("menuitem", {
      name: /kan ikke slettes.*brukes i analysen/i,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await expect(page.getByText("Klar til å dele versjon 1")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Del versjon 1" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", { name: "Klar til bruk" }),
  ).toBeVisible();
});

test("replaces both Task Priority examples before sharing", async ({
  page,
}, testInfo) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Hva vil dere finne ut?").selectOption("taskPriority");
  await page
    .getByLabel("Navn på utkastet")
    .fill(`E2E priority ${testInfo.workerIndex}-${Date.now()}`);
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Del med utvikler" }).click();
  // Scoped to the dialog: the flow overview lists the same issue text.
  await expect(
    page
      .getByRole("dialog", { name: "Del med utvikler" })
      .getByText(/bytt ut eksempeloppgaven/i),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const first = page.getByRole("textbox", {
    name: "Alternativ 1",
    exact: true,
  });
  const second = page.getByRole("textbox", {
    name: "Alternativ 2",
    exact: true,
  });
  await first.fill("Søke om støtte");
  await second.fill("Sjekke status");
  await second.press("Tab");
  await expect(
    page.getByRole("button", { name: /endre verdi for alternativ 1/i }),
  ).toHaveText("soke-om-stotte");
  await expect(
    page.getByRole("button", { name: /endre verdi for alternativ 2/i }),
  ).toHaveText("sjekke-status");
  const maxSelections = page.getByLabel(
    "Maks antall alternativer brukeren kan velge",
  );
  await expect(maxSelections).toHaveValue("2");

  // Repair remains announced and focused on repeated use, not only the first.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await maxSelections.fill("");
    await page
      .getByRole("button", { name: "Gjenopprett analyseoppsettet" })
      .click();
    const repairNotice = page
      .locator('div[tabindex="-1"]')
      .filter({ hasText: "Analyseoppsettet er gjenopprettet" });
    await expect(repairNotice).toBeFocused();
    await expect(maxSelections).toHaveValue("2");
  }

  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await expect(page.getByText("Klar til å dele versjon 1")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Del versjon 1" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\/revisions\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", { name: "Klar til bruk" }),
  ).toBeVisible();
});

test("authors intro and confirmation screens that render in the real widget", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Skjerm-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Legg til velkomstside" }).click();
  const introCard = page.getByRole("region", { name: "Velkomstside" });
  await expect(introCard).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  await introCard.getByLabel("Tittel").fill("Velkommen");
  await introCard.getByLabel("Tekst (valgfri)").fill("To korte spørsmål.");
  await introCard.getByLabel(/Tekst på startknappen/).fill("Kom i gang");

  // An explicit restart flushes the latest valid editor state instead of
  // waiting for the stage's normal debounce.
  const stage = page.getByRole("region", { name: "Forhåndsvisning" });
  await page
    .getByRole("button", { name: "Start forhåndsvisningen på nytt" })
    .click();
  await expect(stage.getByRole("heading", { name: "Velkommen" })).toBeVisible();
  await expect(stage.getByText("To korte spørsmål.")).toBeVisible();
  await stage.getByRole("button", { name: "Kom i gang" }).click();
  await expect(stage.getByRole("radio", { name: /5\./ })).toBeVisible();
  await page.clock.resume();

  await expect(
    page.getByText(
      "Vises etter at brukeren har sendt inn svarene. Uten tilpasning brukes standardteksten.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tilpass bekreftelsen" }).click();
  await page
    .getByRole("region", { name: "Bekreftelse etter innsending" })
    .getByLabel("Tittel")
    .fill("Takk for svaret!");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expectNoAxeViolations(page);

  // The live stage stays alongside the editor on ordinary laptop widths.
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const stickyStageTop = await stage.evaluate((element) => {
    const preview = element.parentElement;
    if (!preview) throw new Error("Preview stage is missing its aside");
    const styles = getComputedStyle(preview);
    return Math.round(
      Number.parseFloat(styles.top) + Number.parseFloat(styles.paddingTop),
    );
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() =>
      stage.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBe(stickyStageTop);
  await expect(stage).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 0));

  // The stage keeps editing flowing: no Start-gate in front of questions.
  await expect(stage.getByRole("radio", { name: /5\./ })).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Kom i gang" }),
  ).not.toBeVisible();

  // The authored confirmation shows after submitting in the stage.
  await stage.getByRole("radio", { name: /5\./ }).click();
  await stage.getByRole("button", { name: "Send" }).click();
  await expect(
    stage.getByRole("heading", { name: "Takk for svaret!" }),
  ).toBeVisible();

  // «Start på nytt» previews the intro live in the stage; the walk-through
  // continues into the questions.
  await page
    .getByRole("button", { name: "Start forhåndsvisningen på nytt" })
    .click();
  await expect(stage.getByRole("heading", { name: "Velkommen" })).toBeVisible();
  await stage.getByRole("button", { name: "Kom i gang" }).click();
  await expect(stage.getByRole("radio", { name: /5\./ })).toBeVisible();

  // The full-tab preview runs the real intro flow.
  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Prøv i egen fane" }).click();
  const preview = await previewPromise;
  await expect(
    preview.getByRole("heading", { name: "Velkommen" }),
  ).toBeVisible();
  await expect(preview.getByText("To korte spørsmål.")).toBeVisible();
  await preview.getByRole("button", { name: "Kom i gang" }).click();
  await expect(preview.getByRole("radio", { name: /5\./ })).toBeVisible();
  await preview.close();

  // Selecting another editor page exits the from-start walkthrough and makes
  // the stage follow the selected page again.
  await page.getByRole("button", { name: "Ny side" }).click();
  // A titled page heads its own questions, so the stage shows the title.
  await page
    .getByRole("button", { name: "Legg til felles overskrift" })
    .click();
  await page.getByLabel("Felles overskrift").fill("Om deg");
  await expect(stage.getByRole("heading", { name: "Om deg" })).toBeVisible({
    timeout: 10000,
  });
  await page
    .getByRole("button", { name: "Start forhåndsvisningen på nytt" })
    .click();
  await expect(stage.getByRole("heading", { name: "Velkommen" })).toBeVisible();
  await page
    .getByRole("button", { name: /01.*Hvordan opplevde du tjenesten/ })
    .click();
  await expect(
    stage.getByRole("heading", { name: "Hvordan opplevde du tjenesten?" }),
  ).toBeVisible();
  await expect(
    stage.getByRole("heading", { name: "Velkommen" }),
  ).not.toBeVisible();

  // Removing the intro is reversible: focus lands on the undo (house
  // pattern for deletions), and undoing restores the content with focus
  // in the title field.
  await page.getByRole("button", { name: "Fjern velkomstsiden" }).click();
  await expect(page.getByText("Velkomstsiden ble fjernet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Angre", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Angre", exact: true }).click();
  const restoredTitle = page
    .getByRole("region", { name: "Velkomstside" })
    .getByLabel("Tittel");
  await expect(restoredTitle).toHaveValue("Velkommen");
  await expect(restoredTitle).toBeFocused();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
});

test("deletes a draft from the index after confirmation", async ({ page }) => {
  // Mock state outlives CI retries — a unique name keeps reruns isolated.
  const draftName = `Slette-utkast-${Date.now()}`;
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill(draftName);
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  // Freeze a revision so the deletion provably takes revisions with it.
  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await page.getByRole("button", { name: "Del versjon 1" }).click();
  await page.waitForURL(/\/surveyverksted\/revisions\//);
  const revisionUrl = page.url();

  // SPA-navigate back to the index (same QueryClient!) so the revision
  // detail stays cached — the deletion must evict it, not a full reload.
  await page.getByRole("link", { name: "Surveyverksted" }).first().click();
  await page.waitForURL(/\/surveyverksted$/);
  await page
    .getByRole("button", { name: `Handlinger for ${draftName}`, exact: false })
    .click();
  await page.getByRole("menuitem", { name: "Slett utkast" }).click();

  const dialog = page.getByRole("dialog", { name: "Slett utkastet?" });
  await expect(dialog.getByText(/delte versjoner/)).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Slett utkastet" }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(draftName)).toHaveCount(0);
  // The native dialog lost its trigger — focus lands on the list heading.
  await expect(
    page.getByRole("heading", { name: "Teamets utkast" }),
  ).toBeFocused();

  // History back is an SPA navigation: with the detail cache evicted the
  // route must refetch and land in the not-found state — a stale cache
  // would render the deleted revision from memory.
  await page.goBack();
  await expect(page).toHaveURL(revisionUrl);
  await expect(page.getByText(/Den delte versjonen finnes ikke/)).toBeVisible({
    timeout: 10000,
  });
});

test("the delete dialog refuses to close while deletion is pending", async ({
  page,
}) => {
  const draftName = `Slette-lås-${Date.now()}`;
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill(draftName);
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);
  await page.goto("/surveyverksted");

  // First delete attempt: slow, then a server failure. The resolver lets
  // the test wait until the request is provably on the wire.
  let intercepted = false;
  let deleteOnTheWire!: () => void;
  const deleteRequestSent = new Promise<void>((resolve) => {
    deleteOnTheWire = resolve;
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const body = request.postData() ?? "";
    if (
      !intercepted &&
      request.method() === "POST" &&
      body.includes('"projectId"') &&
      !body.includes('"document"') &&
      !body.includes('"expectedDraftVersion"')
    ) {
      intercepted = true;
      deleteOnTheWire();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ status: 500, body: "boom" });
      return;
    }
    await route.continue();
  });

  await page
    .getByRole("button", { name: `Handlinger for ${draftName}`, exact: false })
    .click();
  await page.getByRole("menuitem", { name: "Slett utkast" }).click();
  const dialog = page.getByRole("dialog", { name: "Slett utkastet?" });
  const confirm = dialog.getByRole("button", { name: "Slett utkastet" });
  await confirm.click();
  await deleteRequestSent;

  // Escape while the mutation is in flight must not strand the dialog.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // The failure keeps the dialog with the error and a working retry.
  await expect(dialog.getByText(/kunne ikke slettes/i)).toBeVisible();
  await page.unroute("**/*");
  await dialog.getByRole("button", { name: "Slett utkastet" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(draftName)).toHaveCount(0);
});

test("undo restores the deletion without losing later edits, and sharing surfaces missing metadata", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Angre-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  // Two seeded questions, both auto-expanded. Delete the second one.
  await expect(page.getByLabel("Spørsmålstekst")).toHaveCount(2);
  await page.getByRole("button", { name: "Slett spørsmålet" }).last().click();
  await expect(page.getByLabel("Spørsmålstekst")).toHaveCount(1);

  // Make an unrelated edit AFTER the deletion, then undo.
  await draftField(page).fill("Redigert etter sletting");
  await page.getByRole("button", { name: "Angre", exact: true }).click();

  // The question is back AND the later edit survives.
  await expect(page.getByLabel("Spørsmålstekst")).toHaveCount(2);
  await expect(draftField(page)).toHaveValue("Redigert etter sletting");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // Sharing with a missing survey-ID names the problem instead of waiting forever.
  await page
    .getByRole("button", { name: "Innstillinger for utkastet" })
    .click();
  await page.getByLabel("Foreslått survey-ID").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Lukk" }).click();
  await page.getByRole("button", { name: "Del med utvikler" }).click();
  await expect(page.getByText(/mangler navn eller survey-ID/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Åpne innstillinger" }),
  ).toBeVisible();

  // Restore the survey-ID so the draft can save again.
  await page.getByRole("button", { name: "Åpne innstillinger" }).click();
  await page.getByLabel("Foreslått survey-ID").fill("angre-utkast-v1");
  await page.getByRole("dialog").getByRole("button", { name: "Lukk" }).click();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // Leaving right inside the autosave debounce must flush, not discard.
  await draftField(page).fill("Skrevet rett før tilbake");
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);

  // Reopening within staleTime must hand back the flushed draft (fresh cache),
  // and further saves must not hit a stale-version conflict.
  await page
    .getByRole("link", { name: /Angre-utkast/ })
    .first()
    .click();
  await expect(draftField(page)).toHaveValue("Skrevet rett før tilbake");
  await draftField(page).fill("Redigert etter gjenåpning");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(page.getByText(/endret i en annen fane/)).not.toBeVisible();

  // An edit made WHILE the leave-flush request is on the wire must get its
  // own follow-up save, not be silently dropped.
  let delayedOnce = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      !delayedOnce &&
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedVersion"')
    ) {
      delayedOnce = true;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.continue();
  });
  await draftField(page).fill("Racer A");
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await draftField(page).fill("Racer B under flush");
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);
  await page.unroute("**/*");
  await page
    .getByRole("link", { name: /Angre-utkast/ })
    .first()
    .click();
  await expect(draftField(page)).toHaveValue("Racer B under flush");

  // Inline name editing commits per keystroke, so browser Back mid-edit
  // (no blur) still flushes the new name.
  await page.getByRole("button", { name: /Endre navn på utkastet/ }).click();
  await page.getByLabel("Navn på utkastet").fill("Nytt navn uten blur");
  await page.goBack();
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);
  await expect(
    page.getByRole("link", { name: /Nytt navn uten blur/ }).first(),
  ).toBeVisible();
});

test("the navigation flush is single-flight and never races the autosave", async ({
  page,
}) => {
  test.setTimeout(60000);
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Flush-koordinator");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // Slow the next draft save far past the old 5s wait, count every save PUT.
  let saveCount = 0;
  let delayedOnce = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedVersion"')
    ) {
      saveCount += 1;
      if (!delayedOnce) {
        delayedOnce = true;
        await new Promise((resolve) => setTimeout(resolve, 5500));
      }
    }
    await route.continue();
  });

  // Let the autosave itself start the slow request…
  await draftField(page).fill("Treg autosave A");
  await page.waitForTimeout(1000);
  // …then navigate away twice in quick succession while it is in flight.
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await page
    .getByRole("button", { name: "Til Surveyverksted" })
    .click({ timeout: 2000 })
    .catch(() => {});
  await expect(page).toHaveURL(/\/surveyverksted\?team=/, { timeout: 15000 });
  await page.unroute("**/*");

  // Exactly one PUT, no self-inflicted conflict prompts.
  expect(saveCount).toBe(1);
  expect(dialogs).toEqual([]);

  // The draft survived, and further edits save without conflict noise.
  await page
    .getByRole("link", { name: /Flush-koordinator/ })
    .first()
    .click();
  await expect(draftField(page)).toHaveValue("Treg autosave A");
  await draftField(page).fill("Etterpå");
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(page.getByText(/endret i en annen fane/)).not.toBeVisible();
});

test("a flush inherits a failed save instead of repeating it", async ({
  page,
  context,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Konflikt-test");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  const editorUrl = page.url();

  // Another tab saves version 2 behind this editor's back.
  const other = await context.newPage();
  await other.goto(editorUrl);
  await draftField(other).fill("Endret i fane B");
  await expect(other.locator('[data-state="saved"]')).toBeVisible();
  await other.close();

  // Slow tab A's doomed save so the back-navigation waits on it.
  let saveCount = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedVersion"')
    ) {
      saveCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await route.continue();
  });

  await draftField(page).fill("Fra fane A");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();

  // The flush inherits the 409: one confirm, no second PUT, editor stays.
  await expect
    .poll(() => dialogs.length, { timeout: 10000 })
    .toBeGreaterThan(0);
  expect(dialogs[0]).toContain("konflikt");
  expect(saveCount).toBe(1);
  await expect(page).toHaveURL(/\/surveyverksted\/[0-9a-f-]+/);
  await expect(page.getByText(/endret i en annen fane/)).toBeVisible();
  await page.unroute("**/*");
});

test("configures and previews a searchable multi-choice question", async ({
  page,
}, testInfo) => {
  await page.goto("/surveyverksted");
  await page
    .getByLabel("Navn på utkastet")
    .fill(`Søkbart flervalg ${testInfo.workerIndex}-${Date.now()}`);
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByRole("menuitem", { name: /Flervalg/ }).click();
  const prompt = "Hvilke temaer er viktigst?";
  await page
    .getByRole("textbox", { name: "Spørsmålstekst" })
    .last()
    .fill(prompt);
  for (let option = 3; option <= 7; option += 1) {
    await page.getByRole("button", { name: "Legg til alternativ" }).click();
  }
  await page.getByRole("checkbox", { name: /^Bland rekkefølgen/ }).click();
  await page.getByRole("radio", { name: "Søkbart felt" }).click();
  await page
    .getByLabel("Maks antall alternativer brukeren kan velge")
    .fill("1");

  const stage = page.getByRole("region", { name: "Forhåndsvisning" });
  const combobox = stage.getByRole("combobox", { name: prompt });
  await expect(combobox).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expectNoAxeViolations(page);

  await combobox.click();
  await page.getByRole("option", { name: "Alternativ 1" }).click();
  await expect(stage.getByText("Maks 1 valgt")).toBeVisible();
  await combobox.click();
  await expect(
    page.getByRole("option", { name: "Alternativ 2", exact: true }),
  ).toBeDisabled();

  // The choices are stored in the draft, not only held in the open editor.
  await page.reload();
  await expect(stage.getByRole("combobox", { name: prompt })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(prompt) }).click();
  await expect(
    page.getByRole("checkbox", { name: /^Bland rekkefølgen/ }),
  ).toBeChecked();
  await expect(page.getByRole("radio", { name: "Søkbart felt" })).toBeChecked();
  await expect(
    page.getByLabel("Maks antall alternativer brukeren kan velge"),
  ).toHaveValue("1");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("Slik vises svaralternativene", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expectNoAxeViolations(page);
});

test("a visibility condition set in the editor gates the question live in the stage", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Betinget-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  const stage = page.getByLabel("Forhåndsvisning");

  // The seeded draft already gates the follow-up on the rating, so the stage
  // starts with one question — the shape the widget ships in production.
  await expect(page.getByLabel("Spørsmål", { exact: true })).toHaveValue(
    "rating",
  );
  await expect(page.getByLabel("Vilkår")).toHaveValue("EXISTS");
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("radio").nth(2).click();
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).toBeVisible();

  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expectNoAxeViolations(page);

  // Removing the condition brings the question back unconditionally.
  await page.getByRole("button", { name: "Fjern betingelsen" }).click();
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).toBeVisible({ timeout: 10000 });

  // multiChoice references only offer operators that can match arrays,
  // and CONTAINS gates live in the stage.
  await page.getByRole("button", { name: "Vurdering" }).click();
  await page.getByRole("menuitem", { name: /Flervalg/ }).click();
  await page
    .getByRole("button", { name: /Vis bare hvis/ })
    .last()
    .click();
  await expect(page.getByRole("option", { name: "inneholder" })).toBeAttached();
  await expect(page.getByRole("option", { name: "er lik" })).toHaveCount(0);
  await page.getByLabel("Vilkår").selectOption("CONTAINS");
  await expect(
    page.getByLabel("Verdi", { exact: true }).locator("option:checked"),
  ).toHaveText("Alternativ 1");
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("checkbox", { name: "Alternativ 1" }).click();
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // The full condition UI (question/operator/value + warnings-free state)
  // must also pass axe in dark mode.
  await page.getByRole("button", { name: "Bytt til mørk modus" }).click();
  await expectNoAxeViolations(page);
});

test("an any/all group over two conditions gates the question live in the stage", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Gruppe-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  // A third question that can reference both seeded questions.
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByRole("menuitem", { name: /Vurdering/ }).click();
  await page
    .getByRole("textbox", { name: "Spørsmålstekst" })
    .last()
    .fill("Vil du utdype?");

  const stage = page.getByLabel("Forhåndsvisning");
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).toBeVisible();

  // First condition: rating answered. Second: the text question answered.
  await page
    .getByRole("button", { name: /Vis bare hvis/ })
    .last()
    .click();
  // The seeded follow-up carries a condition of its own, so scope the group
  // controls to the question under test.
  await page
    .getByRole("button", { name: "Legg til betingelse" })
    .last()
    .click();
  await expect(page.getByText("Alle må stemme")).toBeVisible();
  await page
    .getByLabel("Spørsmål", { exact: true })
    .last()
    .selectOption({ index: 1 });

  // Let the autosave settle first — its completion remounts the stage and
  // would otherwise wipe answers given in between.
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // ALL: nothing answered yet → hidden; rating alone is not enough.
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).not.toBeVisible({
    timeout: 10000,
  });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).not.toBeVisible();

  // ANY: the document edit remounts the stage (answers reset), and one
  // answered condition is then enough.
  await page.getByText("Minst én må stemme").click();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).toBeVisible();

  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Bytt til mørk modus" }).click();
  await expectNoAxeViolations(page);

  // Removing the second row collapses back to a single leaf: the
  // combinator toggle disappears and the remaining condition still gates.
  await page.getByRole("button", { name: "Fjern betingelse 2" }).click();
  await expect(page.getByText("Minst én må stemme")).toHaveCount(0);
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("radiogroup", { name: "Vil du utdype?" }),
  ).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
});

test("follow-up branches read live in the cards and in the flow overview", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Gren-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  const stage = page.getByLabel("Forhåndsvisning");

  // One gesture wires a branch: a text follow-up gated on the low answers.
  await page
    .getByRole("button", { name: "Legg til oppfølging" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Ved lavt svar (1–2)" }).click();
  await expect(
    page.getByRole("textbox", { name: "Spørsmålstekst" }).nth(1),
  ).toHaveValue("Hva var det som ikke fungerte?");
  // The condition reads back in plain language inside the editor.
  await expect(
    page
      .getByText("Vises når svaret på «Hvordan opplevde du tjenesten?» er 1–2")
      .first(),
  ).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();

  // Live mirror: without answers every branch is hidden; a low answer in
  // the stage flips both conditional questions to visible. Scoped to the
  // cards — the (closed) flow overview renders the same chips in its DOM.
  const cardChips = (text: string) =>
    page.locator("article").getByText(text, { exact: true });
  await expect(cardChips("Vises nå")).toHaveCount(0);
  await expect(cardChips("Skjult nå")).toHaveCount(2);
  await stage.getByRole("radio").first().click();
  await expect(cardChips("Vises nå")).toHaveCount(2);
  await expect(cardChips("Skjult nå")).toHaveCount(0);

  // The flow overview shows the same journey and jumps to the question.
  await page.getByRole("button", { name: /Flyten/ }).click();
  const flow = page.getByRole("dialog", { name: "Flyten" });
  await expect(
    flow.getByText(
      "Vises når svaret på «Hvordan opplevde du tjenesten?» er 1–2",
    ),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await flow.getByRole("button", { name: /Hva kan vi gjøre bedre\?/ }).click();
  await expect(flow).not.toBeVisible();
  // The jump lands focus in the target's prompt, mounted or not.
  await expect(page.locator(":focus")).toHaveValue("Hva kan vi gjøre bedre?");
});
