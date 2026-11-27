import { act } from "@testing-library/react";
import { vi } from "vitest";

/** A box in viewport coordinates, in pixels. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

const DEFAULT_VIEWPORT: Size = { width: 1000, height: 800 };

/** In the middle of the default viewport, with all of it on screen. */
const ON_SCREEN: Box = { top: 100, left: 100, width: 600, height: 400 };

interface Registration {
  previousThresholdIndex: number;
  previousIsIntersecting: boolean;
}

const layout: {
  viewport: Size;
  /** Where the observed elements are. Null until a test has placed them. */
  box: Box | null;
  /** Elements a test has placed somewhere else than the rest. */
  ownBoxes: Map<Element, Box>;
  /** False imitates a cross-origin iframe, where entries have no root. */
  reportsRootBounds: boolean;
} = {
  viewport: DEFAULT_VIEWPORT,
  box: null,
  ownBoxes: new Map(),
  reportsRootBounds: true,
};

const rectOf = (box: Box) => ({
  ...box,
  x: box.left,
  y: box.top,
  right: box.left + box.width,
  bottom: box.top + box.height,
});

/**
 * jsdom has no layout and no IntersectionObserver. This stand-in follows the
 * rules a browser follows: an observer reports an element when it is first
 * observed, and after that only when the visible share of its area passes one
 * of the observer's thresholds or it starts or stops touching the viewport.
 * A test moves the observed elements with `placeObserved`. The stand-in
 * observes against the viewport only. It refuses a `root` or a `rootMargin`,
 * so a test cannot pass on an option the stand-in does not follow.
 */
export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly thresholds: readonly number[];
  private readonly registrations = new Map<Element, Registration>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    if (options?.root || (options?.rootMargin ?? "0px") !== "0px") {
      throw new Error(
        "The stand-in for IntersectionObserver has no root and no rootMargin",
      );
    }
    const threshold = options?.threshold ?? 0;
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
    FakeIntersectionObserver.instances.push(this);
  }

  get elements(): Element[] {
    return [...this.registrations.keys()];
  }

  observe(element: Element): void {
    if (!this.registrations.has(element)) {
      this.registrations.set(element, {
        previousThresholdIndex: -1,
        previousIsIntersecting: false,
      });
    }
  }

  unobserve(element: Element): void {
    this.registrations.delete(element);
  }

  disconnect(): void {
    this.registrations.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Reports the elements whose state has changed. True if any had. */
  update(): boolean {
    const entries = this.measureAll();
    this.deliver(entries);
    return entries.length > 0;
  }

  /** The entries of the elements whose state has changed, not yet reported. */
  measureAll(): IntersectionObserverEntry[] {
    const entries: IntersectionObserverEntry[] = [];
    for (const [element, registration] of this.registrations) {
      const box = layout.ownBoxes.get(element) ?? layout.box;
      const entry = box && this.measure(element, registration, box);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /** Reports entries, also when the observer has been disconnected since. */
  deliver(entries: IntersectionObserverEntry[]): void {
    if (entries.length > 0) {
      this.callback(entries, this as unknown as IntersectionObserver);
    }
  }

  /** The entry for an element, or null when its state has not changed. */
  private measure(
    element: Element,
    registration: Registration,
    box: Box,
  ): IntersectionObserverEntry | null {
    const { viewport, reportsRootBounds } = layout;
    const root = rectOf({ top: 0, left: 0, ...viewport });
    const target = rectOf(box);
    // Touching edges count, also when one of the boxes has no area.
    const isIntersecting =
      target.left <= root.right &&
      target.right >= root.left &&
      target.top <= root.bottom &&
      target.bottom >= root.top;
    const left = Math.max(target.left, root.left);
    const top = Math.max(target.top, root.top);
    const intersection = isIntersecting
      ? rectOf({
          left,
          top,
          width: Math.min(target.right, root.right) - left,
          height: Math.min(target.bottom, root.bottom) - top,
        })
      : rectOf({ left: 0, top: 0, width: 0, height: 0 });
    const targetArea = target.width * target.height;
    const intersectionRatio =
      targetArea > 0
        ? (intersection.width * intersection.height) / targetArea
        : isIntersecting
          ? 1
          : 0;
    const firstAbove = this.thresholds.findIndex(
      (threshold) => threshold > intersectionRatio,
    );
    const thresholdIndex =
      firstAbove === -1 ? this.thresholds.length : firstAbove;

    if (
      registration.previousThresholdIndex === thresholdIndex &&
      registration.previousIsIntersecting === isIntersecting
    ) {
      return null;
    }
    registration.previousThresholdIndex = thresholdIndex;
    registration.previousIsIntersecting = isIntersecting;
    return {
      target: element,
      isIntersecting,
      intersectionRatio,
      intersectionRect: intersection,
      boundingClientRect: target,
      rootBounds: reportsRootBounds ? root : null,
      // As a browser, the time the element was measured.
      time: performance.now(),
    } as unknown as IntersectionObserverEntry;
  }
}

/**
 * Installs the stand-in. Call `vi.unstubAllGlobals()` after the test. The
 * observed elements are nowhere until the test places them, so nothing is
 * reported before that.
 */
export const installFakeIntersectionObserver = (
  options: { viewport?: Size; reportsRootBounds?: boolean } = {},
): void => {
  FakeIntersectionObserver.instances = [];
  layout.viewport = options.viewport ?? DEFAULT_VIEWPORT;
  layout.reportsRootBounds = options.reportsRootBounds ?? true;
  layout.box = null;
  layout.ownBoxes = new Map();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
};

/**
 * Lets the observers report, as a browser does once per frame. An observer
 * that starts observing in its callback is reported in the next round.
 */
const runFrames = (): void => {
  for (let round = 0; round < 10; round += 1) {
    const reported = FakeIntersectionObserver.instances
      .map((observer) => observer.update())
      .some(Boolean);
    if (!reported) {
      return;
    }
  }
  throw new Error("The observers never settled");
};

/**
 * Places every observed element in the viewport and lets the observers
 * report. Without a box the element is in the middle of the viewport, with
 * all of it on screen. With `only`, that element alone is moved and the
 * others stay where they are.
 */
export const placeObserved = (box: Partial<Box> = {}, only?: Element): void => {
  act(() => {
    if (only) {
      layout.ownBoxes.set(only, { ...ON_SCREEN, ...box });
    } else {
      layout.ownBoxes.clear();
      layout.box = { ...ON_SCREEN, ...box };
    }
    runFrames();
  });
};

/**
 * Places every observed element as `placeObserved` does, and lets the
 * observers measure now. The returned function delivers the reports later,
 * as a browser can: after the page has moved, or after an observer is gone.
 */
export const placeObservedAndReportLater = (
  box: Partial<Box> = {},
): (() => void) => {
  let held: [FakeIntersectionObserver, IntersectionObserverEntry[]][] = [];
  act(() => {
    layout.ownBoxes.clear();
    layout.box = { ...ON_SCREEN, ...box };
    held = FakeIntersectionObserver.instances.map((observer) => [
      observer,
      observer.measureAll(),
    ]);
  });
  return () =>
    act(() => {
      for (const [observer, entries] of held) {
        observer.deliver(entries);
      }
    });
};

/** Scrolls the observed elements out below the viewport. */
export const placeObservedBelowTheFold = (): void => {
  placeObserved({ top: layout.viewport.height + 1200 });
};

/** Lets the observers report without moving anything. */
export const nextFrame = (): void => {
  act(runFrames);
};

/** Elements that are being observed right now, once each. */
export const observedElements = (): Element[] => [
  ...new Set(
    FakeIntersectionObserver.instances.flatMap((observer) => observer.elements),
  ),
];
