import AxeBuilder from "@axe-core/playwright";
import { expect, type JSHandle, type Page, test } from "@playwright/test";

const surveyUrl = "/feedback?team=team-esyfo&surveyId=survey-redaction";
test.use({ screenshot: "only-on-failure" });

function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function repeatEscape(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.down("Escape");
  await page.keyboard.down("Escape");
  await page.keyboard.up("Escape");
}

function maskingDialog(page: Page) {
  return page.getByRole("dialog", {
    name: "Masker fritekstsvar",
    includeHidden: true,
  });
}

interface NativeDialogState {
  dialog: HTMLDialogElement;
  cancellations: boolean[];
  closes: number;
  closeEvents: { cancelable: boolean; trusted: boolean }[];
}

async function observeNativeDialog(page: Page) {
  return maskingDialog(page).evaluateHandle((dialog: HTMLDialogElement) => {
    const state: NativeDialogState = {
      dialog,
      cancellations: [],
      closes: 0,
      closeEvents: [],
    };
    dialog.addEventListener("cancel", (event) => {
      state.cancellations.push(event.cancelable);
    });
    dialog.addEventListener("close", (event) => {
      state.closes += 1;
      state.closeEvents.push({
        cancelable: event.cancelable,
        trusted: event.isTrusted,
      });
    });
    return state;
  });
}

async function expectNativeOpen(state: JSHandle<NativeDialogState>) {
  await expect
    .poll(() =>
      state.evaluate(({ dialog }) => ({
        mounted: dialog.isConnected,
        open: dialog.open,
        modal: dialog.matches(":modal"),
      })),
    )
    .toEqual({ mounted: true, open: true, modal: true });
}

async function forceNativeClose(state: JSHandle<NativeDialogState>) {
  const closes = await state.evaluate((state) => state.closes);
  // close() emits a real, non-cancelable native close even with closedby="none".
  await state.evaluate(({ dialog }) => dialog.close());
  await expectNativeOpen(state);
  await expect
    .poll(() => state.evaluate((state) => state.closes))
    .toBe(closes + 1);
  expect(await state.evaluate((state) => state.closeEvents.at(-1))).toEqual({
    cancelable: false,
    trusted: true,
  });
  await expect
    .poll(() =>
      state.evaluate(({ dialog }) => dialog.contains(document.activeElement)),
    )
    .toBe(true);
}

async function expectDisabledActions(page: Page) {
  const actions = maskingDialog(page).getByRole("button");
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) await expect(action).toBeDisabled();
}

async function openMasking(page: Page, name: string, mobile = false) {
  await page.goto(`${surveyUrl}&query=${encodeURIComponent(name)}`);
  if (mobile)
    await page.getByRole("button", { name: "Vis mer", exact: true }).click();
  else await page.getByRole("button", { name: "Utvid rad" }).click();
  await page
    .getByRole("button", { name: "Masker tekst", exact: true })
    .press("Enter");
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

test("cancellation restores keyboard focus to the masking trigger", async ({
  page,
}) => {
  await openMasking(page, "Ola Nordmann");
  await selectName(page, "Ola Nordmann");
  const trigger = page.getByRole("button", {
    name: "Masker tekst",
    exact: true,
  });
  const dialog = maskingDialog(page);
  await page
    .getByRole("button", { name: "Avbryt", exact: true })
    .press("Enter");
  // A native close hides the dialog before its asynchronous close event unmounts it.
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await selectName(page, "Ola Nordmann");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("table")).toContainText("Ola Nordmann");
});

test("preparation stays mounted through repeated Escape and native close without a write", async ({
  page,
}) => {
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedTextHash"')
    )
      writes += 1;
  });
  await openMasking(page, "Ola Nordmann");
  await selectName(page, "Ola Nordmann");
  const nativeState = await observeNativeDialog(page);
  const preparation = await page.evaluateHandle(() => {
    const digest = crypto.subtle.digest;
    let fail = () => {};
    const pending = new Promise<ArrayBuffer>((_resolve, reject) => {
      fail = () => reject(new Error("Fixture preparation failure"));
    });
    crypto.subtle.digest = () => pending;
    return { fail, restore: () => (crypto.subtle.digest = digest) };
  });
  try {
    await page
      .getByRole("button", { name: "Masker permanent", exact: true })
      .press("Enter");
    await expectDisabledActions(page);
    await repeatEscape(page);
    await expectNativeOpen(nativeState);
    await forceNativeClose(nativeState);
    expect(writes).toBe(0);
    await preparation.evaluate(({ fail }) => fail());
    await expect(page.getByRole("alert")).toContainText(
      "Maskeringen kunne ikke klargjøres. Last siden på nytt og prøv igjen.",
    );
    await expect(maskingDialog(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Masker permanent", exact: true }),
    ).toBeDisabled();
    expect(writes).toBe(0);
    await page
      .getByRole("button", { name: "Avbryt", exact: true })
      .press("Enter");
    await expect(maskingDialog(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Masker tekst", exact: true }),
    ).toBeFocused();
  } finally {
    await preparation.evaluate(({ fail, restore }) => {
      restore();
      fail();
    });
  }
});

test("repeated Escape preserves a held masking request and its unknown outcome until refresh", async ({
  page,
}, testInfo) => {
  const requestStarted = gate();
  const releaseRequest = gate();
  const requestHandled = gate();
  const refreshStarted = gate();
  const releaseRefresh = gate();
  let holdRefresh = false;
  let writes = 0;
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedTextHash"')
    ) {
      writes += 1;
      requestStarted.release();
      try {
        await releaseRequest.promise;
        await route.abort("connectionreset");
      } finally {
        requestHandled.release();
      }
      return;
    }
    if (holdRefresh && request.method() === "GET") {
      refreshStarted.release();
      await releaseRefresh.promise;
    }
    await route.continue();
  });

  await openMasking(page, "Ola Nordmann");
  await selectName(page, "Ola Nordmann");
  const dialog = maskingDialog(page);
  const nativeState = await observeNativeDialog(page);
  try {
    await page
      .getByRole("button", { name: "Masker permanent", exact: true })
      .press("Enter");
    await requestStarted.promise;
    await expectDisabledActions(page);
    await repeatEscape(page);
    await expectNativeOpen(nativeState);
    await forceNativeClose(nativeState);
    await page.keyboard.press("Enter");
    expect(writes).toBe(1);

    releaseRequest.release();
    await expect(page.getByRole("alert")).toContainText(
      "Kunne ikke bekrefte om teksten ble maskert. Oppdater listen før du prøver igjen.",
    );
    await expect(dialog).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Masker permanent", exact: true }),
    ).toHaveCount(0);
    // A late native close must not discard the error or implicitly refresh it.
    await forceNativeClose(nativeState);
    await expect(page.getByRole("alert")).toContainText(
      "Kunne ikke bekrefte om teksten ble maskert. Oppdater listen før du prøver igjen.",
    );
    expect(writes).toBe(1);
    holdRefresh = true;
    await page.getByRole("button", { name: "Lukk og oppdater" }).press("Enter");
    await refreshStarted.promise;
    await expectDisabledActions(page);
    await repeatEscape(page);
    await expectNativeOpen(nativeState);
    await forceNativeClose(nativeState);
    await expect(page.getByRole("alert")).toContainText(
      "Kunne ikke bekrefte om teksten ble maskert. Oppdater listen før du prøver igjen.",
    );
    expect(writes).toBe(1);
    releaseRefresh.release();
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Åpne svaret på nytt før du maskerer igjen." }),
    ).toBeFocused();
    await expect(page.getByRole("table")).toContainText("Ola Nordmann");
    expect(writes).toBe(1);
  } finally {
    releaseRequest.release();
    releaseRefresh.release();
    if (writes > 0) await requestHandled.promise;
    await testInfo.attach("native-dialog-events", {
      body: JSON.stringify(
        await nativeState.evaluate(
          ({ cancellations, closes, closeEvents }) => ({
            cancellations,
            closes,
            closeEvents,
          }),
        ),
      ),
      contentType: "application/json",
    });
    await page.unroute("**/_serverFn/**");
  }
});

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
  await expect(maskingDialog(page)).toHaveCount(0);
  await expect(page.getByRole("table")).toContainText("Ola Nordmann");

  await page
    .getByRole("button", { name: "Masker tekst", exact: true })
    .press("Enter");
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
  const requestStarted = gate();
  const releaseRequest = gate();
  const requestHandled = gate();
  const nativeState = await observeNativeDialog(page);
  let writes = 0;
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedTextHash"')
    ) {
      writes += 1;
      requestStarted.release();
      try {
        await releaseRequest.promise;
        await route.continue();
      } finally {
        requestHandled.release();
      }
      return;
    }
    await route.continue();
  });
  try {
    await page.keyboard.press("Enter");
    await requestStarted.promise;
    await expectDisabledActions(page);
    await repeatEscape(page);
    await expectNativeOpen(nativeState);
    await forceNativeClose(nativeState);
    await page.keyboard.press("Enter");
    expect(writes).toBe(1);
    releaseRequest.release();
    await expect(maskingDialog(page)).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Teksten er maskert." }),
    ).toBeFocused();
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(writes).toBe(1);
  } finally {
    releaseRequest.release();
    if (writes > 0) await requestHandled.promise;
    await page.unroute("**/_serverFn/**");
  }

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
  await expect(maskingDialog(page)).toHaveCount(0);
  const requestStarted = gate();
  const releaseRequest = gate();
  const requestHandled = gate();
  const nativeState = await observeNativeDialog(other);
  let writes = 0;
  await other.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      (request.postData() ?? "").includes('"expectedTextHash"')
    ) {
      writes += 1;
      requestStarted.release();
      try {
        await releaseRequest.promise;
        await route.continue();
      } finally {
        requestHandled.release();
      }
      return;
    }
    await route.continue();
  });
  try {
    await other
      .getByRole("button", { name: "Masker permanent", exact: true })
      .press("Enter");
    await requestStarted.promise;
    await expectDisabledActions(other);
    await repeatEscape(other);
    await expectNativeOpen(nativeState);
    await forceNativeClose(nativeState);
    expect(writes).toBe(1);
    releaseRequest.release();
    await expect(other.getByRole("alert")).toContainText(
      "Svaret er endret siden du åpnet det",
    );
    await expect(
      other.getByRole("button", { name: "Masker permanent", exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(1);
    await other
      .getByRole("button", { name: "Lukk og oppdater" })
      .press("Enter");
    await expect(maskingDialog(other)).toHaveCount(0);
    await expect(
      other
        .getByRole("status")
        .filter({ hasText: "Åpne svaret på nytt før du maskerer igjen." }),
    ).toBeFocused();
    await expect(other.getByRole("table")).toHaveCount(0);
    expect(writes).toBe(1);
  } finally {
    releaseRequest.release();
    if (writes > 0) await requestHandled.promise;
    await other.unroute("**/_serverFn/**");
  }
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
