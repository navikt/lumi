import { expect, type FrameLocator, type Page, test } from "@playwright/test";

// The viewport is 800 pixels high, so a survey taller than that counts as
// seen when 400 pixels of it are on screen. The browser reports a survey of
// 1500 pixels at every 75 pixels, and both positions in each test are
// between the same two reports.
test.use({
  viewport: { width: 1000, height: 800 },
  screen: { width: 1000, height: 900 },
});

const storyUrl = (story: string, height = 1500) =>
  `/iframe.html?viewMode=story&id=tester-inline-visning--${story}&args=height:${height}`;

type Scope = Page | FrameLocator;

/** The panel of the survey, which is what is measured. */
const PANEL = ".lumi-survey-inline .lumi-survey-dock__panel";

const survey = (scope: Scope) => scope.locator(PANEL);

/** The number of views the survey in this document has reported. */
const views = (scope: Scope) => scope.locator("html");

/** Long enough for the survey to have been measured more than once. */
const settle = (page: Page) => page.waitForTimeout(700);

const expectNoView = async (page: Page, scope: Scope) => {
  await settle(page);
  await expect(views(scope)).toHaveAttribute("data-views", "0");
};

const expectOneView = async (page: Page, scope: Scope) => {
  await expect(views(scope)).toHaveAttribute("data-views", "1");
  // It stays at one, however long the survey is on screen.
  await settle(page);
  await expect(views(scope)).toHaveAttribute("data-views", "1");
};

/** Scrolls the page until `visible` pixels of the survey show at the bottom. */
const showInPage = async (page: Page, scope: Scope, visible: number) => {
  const box = await survey(scope).boundingBox();
  if (!box) throw new Error("The survey is not rendered");
  const viewportHeight = page.viewportSize()?.height ?? 0;
  await page.evaluate(
    (distance) => window.scrollBy(0, distance),
    box.y - (viewportHeight - visible),
  );
};

/**
 * Scrolls the scroll area until `visible` pixels of the survey show at its
 * bottom, on screen. The survey can be in a shadow tree in the area, and a
 * transform can scale the area.
 */
const showInScrollArea = (page: Page, visible: number) =>
  page.evaluate((shown) => {
    const area = document.querySelector<HTMLElement>("[data-scroll-area]");
    const tree =
      document.querySelector("[data-shadow-host]")?.shadowRoot ?? document;
    const element = tree.querySelector(
      ".lumi-survey-inline .lumi-survey-dock__panel",
    );
    if (!area || !element) throw new Error("The story is not rendered");
    const box = area.getBoundingClientRect();
    const scale = box.height / area.offsetHeight;
    const bottom = box.top + (area.clientTop + area.clientHeight) * scale;
    area.scrollTop +=
      (element.getBoundingClientRect().top - (bottom - shown)) / scale;
  }, visible);

/**
 * Scrolls the page until `visible` pixels of the survey show at the bottom
 * of the viewport, on screen. The survey is in an iframe that a transform
 * scales.
 */
const showInScaledFrame = (page: Page, visible: number) =>
  page.evaluate((shown) => {
    const frame = document.querySelector("iframe");
    const element = frame?.contentDocument?.querySelector(
      ".lumi-survey-inline .lumi-survey-dock__panel",
    );
    if (!frame || !element) throw new Error("The story is not rendered");
    const box = frame.getBoundingClientRect();
    const scale = box.height / frame.offsetHeight;
    const top =
      box.top + (frame.clientTop + element.getBoundingClientRect().top) * scale;
    window.scrollBy(0, top - (window.innerHeight - shown));
  }, visible);

/** Scrolls the iframe until `visible` pixels show at its bottom. */
const showInFrame = (frame: FrameLocator, visible: number) =>
  frame.locator("html").evaluate((_html, shown) => {
    const element = document.querySelector(
      ".lumi-survey-inline .lumi-survey-dock__panel",
    );
    if (!element) throw new Error("The survey is not in the iframe");
    window.scrollBy(
      0,
      element.getBoundingClientRect().top - (window.innerHeight - shown),
    );
  }, visible);

test.describe("a view of a survey taller than the viewport", () => {
  test("is counted when the user stops with half of the viewport covered", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-page"));
    await survey(page).waitFor();
    await expectNoView(page, page);

    await showInPage(page, page, 380);
    await expectNoView(page, page);

    await showInPage(page, page, 420);
    await expectOneView(page, page);
  });

  test("is counted in a scroll area, against the height of the area", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-scroll-area"));
    await survey(page).waitFor();

    // The area is 660 pixels high, so half of it is 330.
    await showInScrollArea(page, 310);
    await expectNoView(page, page);

    await showInScrollArea(page, 350);
    await expectOneView(page, page);
  });

  test("is counted for a survey so tall that the browser reports it only once", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-scroll-area", 20000));
    await survey(page).waitFor();
    // The story has made the survey as tall as the test asks for.
    const box = await survey(page).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(20000);

    await showInScrollArea(page, 310);
    await expectNoView(page, page);

    await showInScrollArea(page, 350);
    await expectOneView(page, page);
  });

  test("is counted in a scroll area around the host of a shadow tree", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-shadow-scroll-area"));
    await survey(page).waitFor();

    // The area is 220 pixels high, so half of it is 110.
    await showInScrollArea(page, 90);
    await expectNoView(page, page);

    await showInScrollArea(page, 130);
    await expectOneView(page, page);
  });

  for (const { scale, area, limit } of [
    { scale: 2, area: 200, limit: 200 },
    { scale: 0.5, area: 660, limit: 165 },
  ]) {
    test(`is counted in a scroll area scaled by ${scale}, against what it shows on screen`, async ({
      page,
    }) => {
      await page.goto(
        `${storyUrl("in-scaled-scroll-area")};scale:${scale};area:${area}`,
      );
      await survey(page).waitFor();
      // The area shows `limit` times two pixels on screen.
      const shown = await page
        .locator("[data-scroll-area]")
        .evaluate((element) => element.getBoundingClientRect().height);
      expect(shown).toBeCloseTo(area * scale, 0);

      await showInScrollArea(page, limit - 20);
      await expectNoView(page, page);

      await showInScrollArea(page, limit + 20);
      await expectOneView(page, page);
    });
  }

  test("is counted in an iframe it is rendered into through a portal, against the height of the iframe", async ({
    page,
  }) => {
    await page.goto(storyUrl("in-frame-portal"));
    const frame = page.frameLocator("iframe");
    await survey(frame).waitFor();
    await expectNoView(page, page);

    // The iframe is 200 pixels high, the window around it 800.
    await showInFrame(frame, 80);
    await expectNoView(page, page);

    await showInFrame(frame, 120);
    await expectOneView(page, page);
  });

  for (const { scale, limit } of [
    { scale: 2, limit: 400 },
    { scale: 0.5, limit: 375 },
  ]) {
    test(`is counted in an iframe scaled by ${scale}, against what the viewport shows of it`, async ({
      page,
    }) => {
      await page.goto(`${storyUrl("in-scaled-frame")};scale:${scale}`);
      const frame = page.frameLocator("iframe");
      await survey(frame).waitFor();
      await expectNoView(page, page);

      // The viewport is 800 pixels high and shows 800 / scale of the
      // iframe's pixels. Half of that, or half of the survey when it is
      // lower, is `limit` pixels on screen.
      await showInScaledFrame(page, limit - 20);
      await expectNoView(page, page);

      await showInScaledFrame(page, limit + 20);
      await expectOneView(page, page);
    });
  }

  test("is counted in an iframe from another origin", async ({ page }) => {
    await page.goto(storyUrl("in-other-origin-frame"));
    const frame = page.frameLocator("iframe");
    await survey(frame).waitFor();
    await expectNoView(page, frame);

    // The page and the iframe are two sites to the browser.
    const origins = await Promise.all([
      page.evaluate(() => window.location.origin),
      frame.locator("html").evaluate(() => window.location.origin),
    ]);
    expect(origins[0]).not.toBe(origins[1]);

    // The iframe is taller than the browser window. The survey is not told
    // how tall the viewport is, and measures against the browser window and
    // the screen, whichever the browser says is smallest.
    const inFrame = await frame.locator("html").evaluate(() => ({
      frameHeight: window.innerHeight,
      limit:
        Math.min(
          1500,
          window.innerHeight,
          window.outerHeight || Number.POSITIVE_INFINITY,
          window.screen.height,
        ) / 2,
    }));
    expect(inFrame.frameHeight).toBeGreaterThan(1500);
    expect(inFrame.limit).toBeLessThanOrEqual(450);

    await showInPage(page, frame, Math.floor(inFrame.limit) - 20);
    await expectNoView(page, frame);

    await showInPage(page, frame, Math.ceil(inFrame.limit) + 20);
    await expectOneView(page, frame);
  });
});

test.describe("a view of a survey beside a tall column", () => {
  test("is not counted while only the space that the row stretches around the survey shows", async ({
    page,
  }) => {
    await page.goto(storyUrl("beside-tall-column"));
    await survey(page).waitFor();
    await expectNoView(page, page);

    // The flex row is 2000 pixels high, and so is the element around the
    // survey. The survey's own panel is at the top of the row.
    const row = await page.locator("[data-tall-column]").boundingBox();
    const stretched = await page.locator(".lumi-survey-inline").boundingBox();
    if (!row || !stretched) throw new Error("The story is not rendered");
    expect(stretched.height).toBeGreaterThan(1900);
    await page.evaluate((top) => window.scrollTo(0, top), row.y + 1000);
    await expectNoView(page, page);

    await page.locator(PANEL).scrollIntoViewIfNeeded();
    await expectOneView(page, page);
  });
});

test.describe("a view of a survey that an element hides", () => {
  for (const hide of ["visibility", "opacity"]) {
    test(`is not counted while the element hides it with ${hide}, and is counted when it shows it`, async ({
      page,
    }) => {
      await page.goto(`${storyUrl("in-hiding-element", 300)};hide:${hide}`);
      await survey(page).waitFor({ state: "attached" });

      // All of the survey is on screen, where it cannot be seen.
      await page.evaluate(() =>
        document
          .querySelector(".lumi-survey-inline")
          ?.scrollIntoView({ block: "center" }),
      );
      await expectNoView(page, page);

      await page.locator("[data-hiding]").evaluate((element) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.visibility = "visible";
        element.style.opacity = "1";
      });
      await expectOneView(page, page);
    });
  }
});
