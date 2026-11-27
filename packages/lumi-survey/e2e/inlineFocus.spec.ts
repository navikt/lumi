import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    /** The shadow trees the stories have made. */
    lumiStoryShadowRoots?: ShadowRoot[];
  }
}

const storyUrl = (story: string, args?: string) =>
  `/iframe.html?viewMode=story&id=tester-inline-fokus--${story}${args ? `&args=${args}` : ""}`;

const RECEIPT = "Takk for tilbakemeldingen!";

/**
 * Places can lie between pixels on the page, and scrolling moves the page by
 * whole pixels. The browser reports nothing when a survey moves to rest
 * exactly against the edge of what can be seen, or a few pixels on from
 * there, and the tests need the survey there. This shortens the space above
 * the survey, marked `data-spacer`, by less than a pixel, so the survey's
 * `edge` lies a whole number of pixels from the top of `area`.
 */
const alignSurvey = async (
  page: Page,
  area: "page" | "[data-scroll-area]",
  edge: "top" | "bottom",
) => {
  // The story renders after the page has loaded.
  await page.locator(".lumi-survey-dock__panel").waitFor();
  await page
    .locator(area === "page" ? "body" : area)
    .evaluate((container, side) => {
      const spacer = container.querySelector<HTMLElement>("[data-spacer]");
      const panel = container.querySelector(".lumi-survey-dock__panel");
      if (!spacer || !panel) throw new Error("No survey after a spacer");
      const top =
        container === document.body
          ? -window.scrollY
          : container.getBoundingClientRect().top;
      const offset = panel.getBoundingClientRect()[side] - top;
      const height = spacer.getBoundingClientRect().height;
      spacer.style.height = `${height - (offset - Math.floor(offset))}px`;
      const aligned = panel.getBoundingClientRect()[side] - top;
      // A browser lays out in fractions of a pixel that a number in
      // JavaScript can be a hair off.
      if (Math.abs(aligned - Math.round(aligned)) > 0.001) {
        throw new Error(`The survey is still between pixels: ${aligned}`);
      }
    }, edge);
};

/**
 * Lets the browser report where the survey is after the page has moved. A
 * user takes longer than that before the next key.
 */
const settled = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0)),
        ),
      ),
  );

// A browser sends focus events out of a shadow tree to the document with the
// host as their target. The survey must still know that focus is in it.
for (const story of ["in-page", "in-shadow-tree"]) {
  test.describe(story, () => {
    test("gives the receipt focus when the user went to the page and back before sending", async ({
      page,
    }) => {
      await page.goto(storyUrl(story));
      await page.getByRole("radio", { name: /5\./ }).check();
      await page.getByRole("button", { name: "Knapp på siden" }).focus();
      await page.getByRole("button", { name: "Send" }).focus();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("heading", { name: RECEIPT })).toBeFocused();
    });

    test("leaves focus on the page when the user went there while the answer was sent", async ({
      page,
    }) => {
      await page.goto(storyUrl(story));
      await page.getByRole("radio", { name: /5\./ }).check();
      await page.getByRole("button", { name: "Send" }).focus();
      await page.keyboard.press("Enter");
      const onPage = page.getByRole("button", { name: "Knapp på siden" });
      await onPage.focus();

      await expect(page.getByRole("heading", { name: RECEIPT })).toBeVisible();
      await expect(onPage).toBeFocused();
    });
  });
}

/**
 * The survey's shadow tree, which the story hands the test: a locator does
 * not reach into a closed tree.
 */
const surveyTree = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          window.lumiStoryShadowRoots?.some((root) =>
            root.querySelector('.lumi-survey-inline [role="radio"]'),
          ),
        ),
      ),
    )
    .toBe(true);
  return page.evaluateHandle(() => {
    const tree = window.lumiStoryShadowRoots?.find((root) =>
      root.querySelector(".lumi-survey-inline"),
    );
    if (!tree) throw new Error("The survey is not in a shadow tree");
    return tree;
  });
};

const described = (mode: ShadowRootMode) =>
  mode === "open" ? "an open" : "a closed";

for (const [outer, inner] of [
  ["closed", "open"],
  ["closed", "closed"],
  ["open", "closed"],
  ["open", "open"],
] as const) {
  test(`gives the receipt focus in ${described(inner)} shadow tree in ${described(outer)} tree after focus went to the page and back`, async ({
    page,
  }) => {
    await page.goto(
      storyUrl("in-nested-shadow-trees", `outer:${outer};inner:${inner}`),
    );
    const tree = await surveyTree(page);
    /** The text of the element that has focus in the survey's tree. */
    const focused = () =>
      tree.evaluate((root) => root.activeElement?.textContent ?? null);

    await tree.evaluate((root) => {
      const option = root.querySelectorAll<HTMLElement>('[role="radio"]')[4];
      option.focus();
      option.click();
    });
    // A browser sends the document no focus event when focus moves inside a
    // shadow tree. Focus that comes back from the page sends one.
    await page.getByRole("button", { name: "Knapp på siden" }).focus();
    await tree.evaluate((root) =>
      [...root.querySelectorAll("button")]
        .find((button) => button.textContent === "Send")
        ?.focus(),
    );
    await expect.poll(focused).toBe("Send");
    await page.keyboard.press("Enter");

    await expect.poll(focused).toBe(RECEIPT);
  });
}

test.describe("in an iframe", () => {
  test("gives the receipt focus when the user stays in the iframe", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-frame"));
    const frame = page.frameLocator("iframe");
    await frame.getByRole("radio", { name: /5\./ }).check();
    await frame.getByRole("button", { name: "Send" }).focus();
    await page.keyboard.press("Enter");

    await expect(frame.getByRole("heading", { name: RECEIPT })).toBeFocused();
  });

  test("leaves focus on the page around the iframe when the user went there while the answer was sent", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-frame"));
    const frame = page.frameLocator("iframe");
    await frame.getByRole("radio", { name: /5\./ }).check();
    await frame.getByRole("button", { name: "Send" }).focus();
    await page.keyboard.press("Enter");
    const onPage = page.getByRole("button", { name: "Knapp på siden" });
    await onPage.focus();

    await expect(frame.getByRole("heading", { name: RECEIPT })).toBeVisible();
    await expect(onPage).toBeFocused();
  });
});

// A scroll event does not leave the shadow tree it is sent in.
for (const story of ["in-scroll-area", "in-scroll-area-in-shadow-tree"]) {
  test(`${story}: does not scroll the area back to the receipt when the user scrolled the survey to rest against its edge`, async ({
    page,
  }) => {
    await page.goto(storyUrl(story));
    await alignSurvey(page, "[data-scroll-area]", "top");
    await page.getByRole("radio", { name: /5\./ }).check();
    await page.getByRole("button", { name: "Send" }).focus();
    await page.keyboard.press("Enter");

    /** Scrolls the area until `visible` pixels of the survey show at its bottom. */
    const showInArea = (visible: number) =>
      page.locator("[data-scroll-area]").evaluate((area, shown) => {
        const panel = area.querySelector(".lumi-survey-dock__panel");
        if (!panel) throw new Error("The survey is not in the area");
        const bottom =
          area.getBoundingClientRect().top + area.clientTop + area.clientHeight;
        area.scrollTop += Math.round(
          panel.getBoundingClientRect().top - (bottom - shown),
        );
        return area.scrollTop;
      }, visible);
    // One pixel shows, and then the survey rests against the edge. The
    // browser has no report of its own for the last step.
    await showInArea(1);
    await page.waitForTimeout(100);
    const resting = await showInArea(0);

    await expect(page.getByRole("heading", { name: RECEIPT })).toBeFocused();
    expect(
      await page
        .locator("[data-scroll-area]")
        .evaluate((area) => area.scrollTop),
    ).toBe(resting);
  });
}

test.describe("a survey taller than the viewport", () => {
  // The overflow of `<html>`, and of `<body>` when `<html>` shows its
  // overflow, scrolls the viewport and clips nothing itself.
  for (const scroller of ["viewport", "root", "body"]) {
    test(`brings the receipt into view when it takes the place of the questions, with the page scrolled by the ${scroller}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.goto(storyUrl("tall-in-page", `scroller:${scroller}`));
      // The page is scrolled more than a viewport down when the user is at
      // Send, at the bottom of the survey.
      await page
        .locator("[data-spacer]")
        .evaluate((spacer) => spacer.style.setProperty("height", "1000px"));
      await page
        .getByRole("textbox", { name: /Spørsmål 1:/ })
        .fill("Den var grei");
      const send = page.getByRole("button", { name: "Send" });
      await send.focus();
      const before = await page
        .locator(".lumi-survey-dock__panel")
        .evaluate((panel) => panel.getBoundingClientRect().top);
      expect(before).toBeLessThan(0);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
      await settled(page);
      await page.keyboard.press("Enter");

      const receipt = page.getByRole("heading", { name: RECEIPT });
      await expect(receipt).toBeFocused();
      await expect(receipt).toBeInViewport();
    });
  }

  test("brings the receipt into view when the user scrolls a few pixels of the survey back into view while the answer is sent", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto(storyUrl("tall-in-page"));
    await alignSurvey(page, "page", "bottom");
    await page
      .getByRole("textbox", { name: /Spørsmål 1:/ })
      .fill("Den var grei");
    await page.getByRole("button", { name: "Send" }).focus();
    await page.keyboard.press("Enter");

    /** Scrolls the page until the survey's lower edge is at `bottom`. */
    const putBottomAt = (bottom: number) =>
      page.locator(".lumi-survey-dock__panel").evaluate((panel, at) => {
        window.scrollBy(
          0,
          Math.round(panel.getBoundingClientRect().bottom - at),
        );
      }, bottom);
    const panelHeight = await page
      .locator(".lumi-survey-dock__panel")
      .evaluate((panel) => panel.getBoundingClientRect().height);
    // Fewer pixels than the browser's first step of the survey's area.
    const fewPixels = Math.min(30, Math.floor(panelHeight * 0.04));
    expect(fewPixels).toBeGreaterThan(0);
    // Out over the top, back to rest against it, and a few pixels in. The
    // browser reports the first two moves and not the last.
    for (const bottom of [-100, 0, fewPixels]) {
      await putBottomAt(bottom);
      await page.waitForTimeout(100);
    }

    const receipt = page.getByRole("heading", { name: RECEIPT });
    await expect(receipt).toBeFocused();
    await expect(receipt).toBeInViewport();
  });

  test("gives the receipt focus after mouse clicks, also where a click leaves focus where it was", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-page"));
    await page.getByRole("radio", { name: /5\./ }).click();
    // The user clicks on the page, and comes back with a click on Send. A
    // click on a button leaves focus where it was in Safari, and in Firefox
    // on macOS.
    await page.getByRole("button", { name: "Knapp på siden" }).click();
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("heading", { name: RECEIPT })).toBeFocused();
  });
});
