import { expect, type Page, test } from "@playwright/test";

const VARIANTS = ["emoji", "stars", "thumbs", "nps"] as const;
type Variant = (typeof VARIANTS)[number];

// Half a CSS pixel: browsers lay out in fractions of a pixel.
const TOLERANCE = 0.5;
const REM = 16;

const storyUrl = (id: string, args: Record<string, string | number> = {}) => {
  const list = Object.entries(args)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `/iframe.html?viewMode=story&id=${id}${list ? `&args=${list}` : ""}`;
};

const layoutStory = (
  story: "column" | "flex-row" | "flex-row-beside-long-text" | "shrink-to-fit",
  args: { width?: number; variant: Variant },
) => storyUrl(`tester-inline-layout--${story}`, args);

interface Measurement {
  /** Width of the survey's frame. */
  width: number;
  /** Width of the element the story placed the survey in, if it has one. */
  containerWidth: number | null;
  /** True when the frame is inside the element it stands in. */
  insideContainer: boolean;
  /** Width of the widest block of content inside the frame. */
  contentWidth: number;
  /** Parts of the survey that stick out of its frame to the left or right. */
  outsideFrame: string[];
  /** Icons that stick out of the button they belong to. */
  outsideButton: string[];
  /** True when the page has got a horizontal scrollbar. */
  pageScrollsSideways: boolean;
}

/** Measures every inline survey on the page. */
const measure = (page: Page): Promise<Measurement[]> =>
  page.evaluate((tolerance) => {
    const describe = (element: Element) => {
      const name =
        typeof element.className === "string" && element.className
          ? `.${element.className.split(" ")[0]}`
          : "";
      const box = element.getBoundingClientRect();
      return `${element.tagName.toLowerCase()}${name} ${Math.round(box.left)}–${Math.round(box.right)}`;
    };
    const isShown = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    };
    // Text for screen readers only is clipped to a single pixel. What is
    // inside the clipped element is laid out, but never shown.
    const clips = (element: Element) => {
      const style = getComputedStyle(element);
      return (
        style.position === "absolute" &&
        (style.clip !== "auto" || style.clipPath !== "none")
      );
    };
    const isClipped = (element: Element, root: Element) => {
      for (
        let current: Element | null = element;
        current && current !== root;
        current = current.parentElement
      ) {
        if (clips(current)) {
          return true;
        }
      }
      return false;
    };
    const sticksOut = (inner: DOMRect, outer: DOMRect) =>
      inner.left < outer.left - tolerance ||
      inner.right > outer.right + tolerance;

    return [...document.querySelectorAll(".lumi-survey-inline")].map((root) => {
      const frame = root.getBoundingClientRect();
      const container = root.closest("[data-layout-container]");
      const containerBox = container?.getBoundingClientRect();
      const parts = [...root.querySelectorAll("*")].filter(
        (element) => isShown(element) && !isClipped(element, root),
      );
      const panel = root.querySelector(".lumi-survey-dock__panel");
      return {
        width: frame.width,
        containerWidth: containerBox?.width ?? null,
        insideContainer: containerBox ? !sticksOut(frame, containerBox) : true,
        contentWidth: Math.max(
          0,
          ...[...(panel?.children ?? [])]
            .filter(isShown)
            .map((child) => child.getBoundingClientRect().width),
        ),
        outsideFrame: parts
          .filter((element) =>
            sticksOut(element.getBoundingClientRect(), frame),
          )
          .map(describe),
        outsideButton: [...root.querySelectorAll("button")].flatMap((button) =>
          [...button.querySelectorAll("svg, img")]
            .filter(
              (icon) =>
                isShown(icon) &&
                sticksOut(
                  icon.getBoundingClientRect(),
                  button.getBoundingClientRect(),
                ),
            )
            .map(describe),
        ),
        pageScrollsSideways:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });
  }, TOLERANCE);

const openStory = async (page: Page, url: string) => {
  await page.goto(url);
  await page.locator(".lumi-survey-inline").first().waitFor();
  // Aksel's fonts change the width of the text when they arrive.
  await page.evaluate(() => document.fonts.ready);
};

const expectNothingOutside = (survey: Measurement) => {
  expect(survey.outsideFrame, "parts outside the survey's frame").toEqual([]);
  expect(survey.outsideButton, "icons outside their buttons").toEqual([]);
  expect(survey.insideContainer, "frame inside its container").toBe(true);
  expect(survey.pageScrollsSideways, "page scrolls sideways").toBe(false);
};

/** Answers the rating, so the follow-up state with the send button shows. */
const answerRating = async (page: Page) => {
  await page.locator('.lumi-survey-inline [role="radio"]').first().click();
  await page
    .locator(".lumi-survey-inline")
    .getByRole("button", { name: "Send" })
    .waitFor();
};

test.describe("inline survey in a column", () => {
  for (const variant of VARIANTS) {
    for (const width of [200, 256, 320, 480]) {
      test(`${variant} fits a column of ${width} px`, async ({ page }) => {
        await openStory(page, layoutStory("column", { width, variant }));

        const [survey] = await measure(page);
        expect(survey.containerWidth).toBe(width);
        // The frame follows the column.
        expect(survey.width).toBeCloseTo(width, 0);
        expectNothingOutside(survey);

        await answerRating(page);
        expectNothingOutside((await measure(page))[0]);

        await page.getByRole("button", { name: "Send" }).click();
        await page
          .getByRole("heading", { name: "Takk for tilbakemeldingen!" })
          .waitFor();
        const [receipt] = await measure(page);
        expect(receipt.width).toBeCloseTo(width, 0);
        expectNothingOutside(receipt);
      });
    }

    test(`${variant} keeps its lines short in a wide column`, async ({
      page,
    }) => {
      await openStory(page, layoutStory("column", { width: 900, variant }));

      const [survey] = await measure(page);
      // The frame fills the column, and the content stops at 32rem.
      expect(survey.width).toBeCloseTo(900, 0);
      expect(survey.contentWidth).toBeCloseTo(32 * REM, 0);
      expectNothingOutside(survey);
    });
  }
});

test.describe("inline survey that sets its own width", () => {
  for (const variant of VARIANTS) {
    test(`${variant} takes 32rem plus the frame when nothing limits it`, async ({
      page,
    }) => {
      await openStory(page, layoutStory("shrink-to-fit", { variant }));

      const [survey] = await measure(page);
      expect(survey.contentWidth).toBeCloseTo(32 * REM, 0);
      expect(survey.width).toBeGreaterThan(32 * REM);
      expectNothingOutside(survey);
    });

    test(`${variant} takes 32rem plus the frame in a roomy flex row`, async ({
      page,
    }) => {
      await openStory(page, layoutStory("flex-row", { width: 1000, variant }));

      const [survey] = await measure(page);
      expect(survey.contentWidth).toBeCloseTo(32 * REM, 0);
      expectNothingOutside(survey);
    });

    test(`${variant} shrinks in a tight flex row`, async ({ page }) => {
      await openStory(page, layoutStory("flex-row", { width: 400, variant }));

      const [survey] = await measure(page);
      expect(survey.width).toBeLessThan(32 * REM);
      expectNothingOutside(survey);
    });

    test(`${variant} stops shrinking at 16rem beside a long text`, async ({
      page,
    }) => {
      await openStory(
        page,
        layoutStory("flex-row-beside-long-text", { width: 600, variant }),
      );

      const [survey] = await measure(page);
      // Without a least width the text would squeeze the survey so narrow
      // that its fields stuck out of the frame.
      expect(survey.width).toBeCloseTo(16 * REM, 0);
      expectNothingOutside(survey);
    });
  }
});

test.describe("inline survey on a phone", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  const EXAMPLES = [
    ["under the content", "under-content"],
    ["in a column beside the content", "narrow-column"],
    ["twice on one page", "several-on-one-page"],
    ["with an intro and several pages", "pages-and-intro"],
  ] as const;

  for (const [name, story] of EXAMPLES) {
    test(`the example ${name} fits a viewport of 320 px`, async ({ page }) => {
      await openStory(page, storyUrl(`plassering-ved-innholdet--${story}`));

      const surveys = await measure(page);
      expect(surveys.length).toBeGreaterThan(0);
      for (const survey of surveys) {
        expect(survey.width).toBeLessThanOrEqual(320);
        expectNothingOutside(survey);
      }
    });
  }
});

test.describe("dock on a phone", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("the stars stay inside their buttons", async ({ page }) => {
    await page.goto(storyUrl("components-lumisurveydock-rating--stars"));
    const stars = page.locator('.lumi-survey-dock [role="radio"]');
    // The dock starts minimized when it has not read its storage in time.
    const reopen = page.getByRole("button", { name: "Gi tilbakemelding" });
    await stars.first().or(reopen).waitFor();
    if (await reopen.isVisible()) {
      await reopen.click();
    }
    await expect(stars).toHaveCount(5);
    await page.evaluate(() => document.fonts.ready);

    const measured = await stars.evaluateAll(
      (buttons, tolerance) =>
        buttons.flatMap((button) => {
          const outer = button.getBoundingClientRect();
          return [...button.querySelectorAll("svg")].map((icon) => {
            const inner = icon.getBoundingClientRect();
            return {
              height: inner.height,
              width: inner.width,
              outside:
                inner.left < outer.left - tolerance ||
                inner.right > outer.right + tolerance ||
                inner.top < outer.top - tolerance ||
                inner.bottom > outer.bottom + tolerance,
            };
          });
        }),
      TOLERANCE,
    );

    expect(measured.length).toBeGreaterThanOrEqual(5);
    for (const star of measured) {
      expect(star.outside, "star outside its button").toBe(false);
      // A star that has shrunk is still square, and not a line.
      expect(star.height).toBeGreaterThan(8);
      expect(star.height).toBeCloseTo(star.width, 0);
    }
  });
});
