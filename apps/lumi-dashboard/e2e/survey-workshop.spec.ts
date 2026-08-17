import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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

  const pageTitle = page.getByLabel("Sidetittel");
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

  await page.getByRole("button", { name: "Ny side" }).click();
  await expect(
    page.getByRole("button", { name: /02 Ny side/ }),
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
  await page.getByRole("button", { name: "Prøv surveyen" }).click();
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
  await expect(page.getByText("Klar til å fryse revisjon 1")).toBeVisible();
  await expectNoAxeViolations(page);
  await page
    .getByRole("button", { name: /Frys revisjon 1 og få delbar lenke/ })
    .click();

  await expect(page).toHaveURL(
    /\/surveyverksted\/revisions\/[0-9a-f-]+\?team=team-esyfo/,
  );
  await expect(page.getByText("Låst revisjon")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Klar til bruk" }),
  ).toBeVisible();
  await expect(
    page.getByText("Første delbare revisjon i prosjektet."),
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
  await page.getByLabel("Sidetittel").fill("Redigert etter sletting");
  await page.getByRole("button", { name: "Angre", exact: true }).click();

  // The question is back AND the later edit survives.
  await expect(page.getByLabel("Spørsmålstekst")).toHaveCount(2);
  await expect(page.getByLabel("Sidetittel")).toHaveValue(
    "Redigert etter sletting",
  );
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
  await page.getByLabel("Sidetittel").fill("Skrevet rett før tilbake");
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);

  // Reopening within staleTime must hand back the flushed draft (fresh cache),
  // and further saves must not hit a stale-version conflict.
  await page
    .getByRole("link", { name: /Angre-utkast/ })
    .first()
    .click();
  await expect(page.getByLabel("Sidetittel")).toHaveValue(
    "Skrevet rett før tilbake",
  );
  await page.getByLabel("Sidetittel").fill("Redigert etter gjenåpning");
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
  await page.getByLabel("Sidetittel").fill("Racer A");
  await page.getByRole("button", { name: "Til Surveyverksted" }).click();
  await page.getByLabel("Sidetittel").fill("Racer B under flush");
  await expect(page).toHaveURL(/\/surveyverksted\?team=/);
  await page.unroute("**/*");
  await page
    .getByRole("link", { name: /Angre-utkast/ })
    .first()
    .click();
  await expect(page.getByLabel("Sidetittel")).toHaveValue(
    "Racer B under flush",
  );

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
  await page.getByLabel("Sidetittel").fill("Treg autosave A");
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
  await expect(page.getByLabel("Sidetittel")).toHaveValue("Treg autosave A");
  await page.getByLabel("Sidetittel").fill("Etterpå");
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
  await other.getByLabel("Sidetittel").fill("Endret i fane B");
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

  await page.getByLabel("Sidetittel").fill("Fra fane A");
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

test("a visibility condition set in the editor gates the question live in the stage", async ({
  page,
}) => {
  await page.goto("/surveyverksted");
  await page.getByLabel("Navn på utkastet").fill("Betinget-utkast");
  await page.getByRole("button", { name: "Opprett utkast" }).click();
  await page.waitForURL(/\/surveyverksted\/[0-9a-f-]+/);

  const stage = page.getByLabel("Forhåndsvisning");
  await expect(
    stage.getByRole("textbox", { name: /Hva kan vi gjøre bedre/ }),
  ).toBeVisible();

  // Both seeded questions are expanded; add a condition on the follow-up.
  await page
    .getByRole("button", { name: /Vis bare hvis/ })
    .last()
    .click();
  await expect(page.getByLabel("Spørsmål", { exact: true })).toHaveValue(
    "rating",
  );
  await expect(page.getByLabel("Vilkår")).toHaveValue("EXISTS");

  // The stage now hides the follow-up until the rating is answered.
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
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).toBeVisible();

  // First condition: rating answered. Second: the text question answered.
  await page
    .getByRole("button", { name: /Vis bare hvis/ })
    .last()
    .click();
  await page.getByRole("button", { name: "Legg til betingelse" }).click();
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
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).not.toBeVisible({
    timeout: 10000,
  });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).not.toBeVisible();

  // ANY: the document edit remounts the stage (answers reset), and one
  // answered condition is then enough.
  await page.getByText("Minst én må stemme").click();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
  await expect(
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("group", { name: "Vil du utdype?" }),
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
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).not.toBeVisible({ timeout: 10000 });
  await stage.getByRole("radio").nth(3).click();
  await expect(
    stage.getByRole("group", { name: "Vil du utdype?" }),
  ).toBeVisible();
  await expect(page.locator('[data-state="saved"]')).toBeVisible();
});
