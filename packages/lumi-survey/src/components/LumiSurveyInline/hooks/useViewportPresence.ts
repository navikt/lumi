import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  scrollTargetsAround,
  seesTopWindow,
  shownIn,
  viewOf,
  windowsAround,
} from "../../shared/surveyTree.js";

/** Share of the element, or of the area it is seen through, that must show. */
const SEEN_SHARE = 0.5;

// Half a CSS pixel. Browsers report fractions of a pixel, and an element that
// stops exactly at the limit must not miss it by a rounding error.
const TOLERANCE = 0.5;

// The browser reports when the visible share of the element's area passes one
// of these steps.
const THRESHOLDS = Array.from({ length: 21 }, (_, step) => step / 20);

// Between two steps the browser says nothing. A tall element can pass the
// limit there, and a user who stops scrolling at that point would not be
// counted. So while a part of the element is on screen and it has not yet
// counted as seen, it is measured again this often. Nothing else reaches
// every place an element can be: a scroll area inside the page sends no
// report of its own, an iframe from another site hears no scrolling, and an
// invisible element that becomes visible is not reported at all.
const SAMPLE_INTERVAL_MS = 250;

interface Size {
  width: number;
  height: number;
}

/** A size the browser has not set limits nothing. */
const positive = (size: number | undefined): number =>
  size && size > 0 ? size : Number.POSITIVE_INFINITY;

/**
 * True when the overflow of the element applies to the viewport and not to
 * the element: the overflow of the root does, and so does that of `<body>`
 * when the root shows what overflows it. `<body>` then shows what overflows
 * it too. The viewport is measured as the window.
 */
const clipsViewportOnly = (element: Element, view: Window): boolean => {
  const { documentElement, body } = element.ownerDocument;
  if (element === documentElement) {
    return true;
  }
  if (element !== body) {
    return false;
  }
  const root = view.getComputedStyle(documentElement);
  return root.overflowX === "visible" && root.overflowY === "visible";
};

/**
 * How much of its own size an element covers on screen. A transform can
 * scale it up or down. An element without layout counts as unscaled.
 */
const scaleOf = (shown: number, laidOut: number | undefined): number =>
  laidOut && laidOut > 0 && shown > 0 ? shown / laidOut : 1;

/**
 * The size of the area the element is seen through: the viewport, or a
 * smaller scroll area around the element. It is given in the pixels of the
 * element's own window, as the observer measures the element.
 */
const viewingArea = (entry: IntersectionObserverEntry): Size => {
  // The survey's own window is smaller than the viewport when the survey is
  // in an iframe.
  let view = viewOf(entry.target);
  const area = {
    width: positive(view.innerWidth),
    height: positive(view.innerHeight),
  };
  // A length in the window the loop has come to, times this, is a length in
  // the element's own window. A transform on an iframe scales everything in
  // it.
  const toOwnWindow = { width: 1, height: 1 };
  for (
    let ancestor = shownIn(entry.target);
    ancestor;
    ancestor = shownIn(ancestor)
  ) {
    const ancestorView = viewOf(ancestor);
    // Where the ancestor is on screen, and its size before a transform.
    const shown = ancestor.getBoundingClientRect();
    const laidOut = ancestor as Partial<HTMLElement>;
    if (ancestorView !== view) {
      // Out of an iframe: the ancestor is the iframe, and the page around it
      // shows no more than its window.
      toOwnWindow.width /= scaleOf(shown.width, laidOut.offsetWidth);
      toOwnWindow.height /= scaleOf(shown.height, laidOut.offsetHeight);
      view = ancestorView;
      area.width = Math.min(
        area.width,
        positive(view.innerWidth) * toOwnWindow.width,
      );
      area.height = Math.min(
        area.height,
        positive(view.innerHeight) * toOwnWindow.height,
      );
    }
    if (clipsViewportOnly(ancestor, view)) {
      continue;
    }
    const style = view.getComputedStyle(ancestor);
    // What a scroll area shows on screen: its size without borders and
    // scrollbars, scaled as a transform scales it. An ancestor without a
    // size of its own, such as an inline element, clips nothing.
    if (style.overflowX !== "visible" && ancestor.clientWidth > 0) {
      area.width = Math.min(
        area.width,
        ancestor.clientWidth *
          scaleOf(shown.width, laidOut.offsetWidth) *
          toOwnWindow.width,
      );
    }
    if (style.overflowY !== "visible" && ancestor.clientHeight > 0) {
      area.height = Math.min(
        area.height,
        ancestor.clientHeight *
          scaleOf(shown.height, laidOut.offsetHeight) *
          toOwnWindow.height,
      );
    }
  }
  // The observer measures against the viewport of the browser, in the
  // pixels of the window at the top. An iframe from another site is not told
  // how large the viewport is, and the iframe can be taller than it. The
  // viewport is never larger than the browser window, which is never larger
  // than the screen. Both are given in the pixels of the window at the top
  // too, and a transform on an iframe inside scales them as the rest.
  const viewport = entry.rootBounds ?? {
    width: Math.min(positive(view.outerWidth), positive(view.screen?.width)),
    height: Math.min(positive(view.outerHeight), positive(view.screen?.height)),
  };
  area.width = Math.min(area.width, viewport.width * toOwnWindow.width);
  area.height = Math.min(area.height, viewport.height * toOwnWindow.height);
  return area;
};

/**
 * Whether the element can be seen where it is. The observer reports where an
 * element is, also when it is invisible or fully transparent. `visibility`
 * passes down to the elements inside, also into a shadow tree, but not into
 * an iframe. Opacity applies to everything inside the element that has it.
 */
const isPainted = (element: Element): boolean => {
  let view = viewOf(element);
  for (let node: Element | null = element; node; node = shownIn(node)) {
    const nodeView = viewOf(node);
    const style = nodeView.getComputedStyle(node);
    const crossedFrame = nodeView !== view;
    view = nodeView;
    if ((node === element || crossedFrame) && style.visibility !== "visible") {
      return false;
    }
    // An element with `display: contents` has no box for opacity to apply to.
    if (
      style.display !== "contents" &&
      Number.parseFloat(style.opacity) === 0
    ) {
      return false;
    }
  }
  return true;
};

/**
 * True when the element has a place on the page and none of it can be seen:
 * none of it is inside the viewport, inside a scroll area around it, or
 * inside an iframe from the same site that it is in. A scroll area shows what
 * is inside its border, without its scrollbars. An element that only touches
 * the edge of what can be seen is outside.
 */
const isOutOfSight = (element: Element | null): boolean => {
  if (!element) {
    return false;
  }
  const box = element.getBoundingClientRect();
  // Without layout there is nothing to read.
  if (box.width === 0 && box.height === 0) {
    return false;
  }
  let view = viewOf(element);
  // What can be seen of the element, in the pixels of the window the loop has
  // come to.
  const seen = {
    top: box.top,
    left: box.left,
    bottom: box.bottom,
    right: box.right,
  };
  const keepInWindow = () => {
    seen.top = Math.max(seen.top, 0);
    seen.left = Math.max(seen.left, 0);
    seen.bottom = Math.min(seen.bottom, view.innerHeight);
    seen.right = Math.min(seen.right, view.innerWidth);
  };
  keepInWindow();
  for (
    let ancestor = shownIn(element);
    ancestor;
    ancestor = shownIn(ancestor)
  ) {
    const shown = ancestor.getBoundingClientRect();
    const laidOut = ancestor as Partial<HTMLElement>;
    const scaleX = scaleOf(shown.width, laidOut.offsetWidth);
    const scaleY = scaleOf(shown.height, laidOut.offsetHeight);
    // Where the inside of the ancestor starts, within its border.
    const left = shown.left + (laidOut.clientLeft ?? 0) * scaleX;
    const top = shown.top + (laidOut.clientTop ?? 0) * scaleY;
    const ancestorView = viewOf(ancestor);
    if (ancestorView !== view) {
      // Out of an iframe: the ancestor is the iframe, which shows its window
      // inside its border.
      seen.left = left + seen.left * scaleX;
      seen.right = left + seen.right * scaleX;
      seen.top = top + seen.top * scaleY;
      seen.bottom = top + seen.bottom * scaleY;
      view = ancestorView;
      keepInWindow();
      continue;
    }
    if (clipsViewportOnly(ancestor, view)) {
      continue;
    }
    const style = view.getComputedStyle(ancestor);
    // An inline element, or one without a box of its own, clips nothing.
    if (style.display === "inline" || style.display === "contents") {
      continue;
    }
    if (style.overflowX !== "visible") {
      seen.left = Math.max(seen.left, left);
      seen.right = Math.min(
        seen.right,
        left + (laidOut.clientWidth ?? 0) * scaleX,
      );
    }
    if (style.overflowY !== "visible") {
      seen.top = Math.max(seen.top, top);
      seen.bottom = Math.min(
        seen.bottom,
        top + (laidOut.clientHeight ?? 0) * scaleY,
      );
    }
  }
  return seen.bottom <= seen.top || seen.right <= seen.left;
};

const coversHalf = (visible: number, size: number, area: number): boolean =>
  visible > 0 && visible + TOLERANCE >= Math.min(size, area) * SEEN_SHARE;

/**
 * Half of the element's height and half of its width are on screen, and it
 * can be seen there. In a direction where the element is larger than the
 * area it is seen through, it is enough that it covers half of that area.
 * A page in a tab in the background is not on screen.
 */
const isSeen = (entry: IntersectionObserverEntry): boolean => {
  if (
    !entry.isIntersecting ||
    entry.target.ownerDocument.visibilityState === "hidden"
  ) {
    return false;
  }
  const visible = entry.intersectionRect;
  const element = entry.boundingClientRect;
  const area = viewingArea(entry);
  return (
    coversHalf(visible.height, element.height, area.height) &&
    coversHalf(visible.width, element.width, area.width) &&
    isPainted(entry.target)
  );
};

// An element that only touches the edge of the viewport counts as
// intersecting, with nothing of it on screen.
const isOnScreen = (entry: IntersectionObserverEntry): boolean =>
  entry.isIntersecting &&
  entry.intersectionRect.width > 0 &&
  entry.intersectionRect.height > 0;

export interface ViewportPresence {
  /**
   * True from the first time the element has been on screen: half of its
   * height and half of its width, or enough of it to cover half of the area
   * it is seen through in a direction where it is larger than that area.
   */
  seen: boolean;
  /**
   * Counts the element as seen now. A user who answers a survey has seen it,
   * also when too little of it is on screen to count.
   */
  markSeen: () => void;
}

/**
 * Follows whether an element is on screen. `enabled` says whether the element
 * is rendered. Without `IntersectionObserver` the element counts as seen when
 * it is rendered.
 */
export function useViewportPresence(
  elementRef: RefObject<Element | null>,
  enabled: boolean,
): ViewportPresence {
  const [seen, setSeen] = useState(false);
  const seenRef = useRef(false);

  const markSeen = useCallback(() => {
    seenRef.current = true;
    setSeen(true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    if (typeof IntersectionObserver === "undefined") {
      markSeen();
      return undefined;
    }

    let sampler: number | undefined;
    // A report the browser had queued can come after the observer is
    // disconnected. It must not start measuring again.
    let stopped = false;
    const stopSampling = () => {
      window.clearInterval(sampler);
      sampler = undefined;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (!latest || stopped) {
          return;
        }
        if (!seenRef.current && entries.some(isSeen)) {
          markSeen();
        }
        if (latest.isIntersecting && !seenRef.current) {
          sampler ??= window.setInterval(measureAgain, SAMPLE_INTERVAL_MS);
        } else {
          stopSampling();
        }
      },
      { threshold: THRESHOLDS },
    );
    // Observing the element again makes the browser report where it is now.
    const measureAgain = () => {
      observer.unobserve(element);
      observer.observe(element);
    };
    // The page can come back from the background with the element already on
    // screen. Nothing moves, so the browser reports nothing by itself.
    const ownerDocument = element.ownerDocument;
    const measureWhenShown = () => {
      if (ownerDocument.visibilityState === "visible" && !seenRef.current) {
        measureAgain();
      }
    };
    ownerDocument.addEventListener("visibilitychange", measureWhenShown);
    observer.observe(element);

    return () => {
      stopped = true;
      stopSampling();
      ownerDocument.removeEventListener("visibilitychange", measureWhenShown);
      observer.disconnect();
    };
  }, [elementRef, enabled, markSeen]);

  return { seen, markSeen };
}

// The panel is read in the commit that shows the receipt, before the browser
// paints it. React warns about a layout effect on the server, where the
// survey renders nothing.
const useBrowserLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * Says, when an answer has been sent, whether the user can still see the
 * survey. The receipt takes the place of the questions, so a tall survey can
 * shrink out of the viewport when it comes, with the user still at it. The
 * page must not scroll back to a survey the user has scrolled away from.
 *
 * While `isSending` is true, the panel is read in two ways. The browser
 * reports when the panel passes a step of its visible area, but says nothing
 * when it slides to rest exactly against the edge of the viewport or of a
 * scroll area, or from there a few pixels back. So the panel's place is also
 * read when the send starts and each time the page or a scroll area around
 * it moves. The newer reading counts. In an iframe from another site the page
 * around it cannot be read, and both readings must say that the panel can be
 * seen.
 *
 * Returns a function that tells it for the last send. True before any send.
 */
export function useSightWhileSending(
  panelRef: RefObject<Element | null>,
  isSending: boolean,
): () => boolean {
  const onScreenRef = useRef(true);

  useBrowserLayoutEffect(() => {
    const panel = panelRef.current;
    if (!isSending || !panel) {
      return undefined;
    }
    const seesAll = seesTopWindow(panel);
    let measured = { outOfSight: isOutOfSight(panel), at: performance.now() };
    let reported: { onScreen: boolean; at: number } | undefined;
    const measure = () => {
      measured = { outOfSight: isOutOfSight(panel), at: performance.now() };
    };
    // `time` is when the browser measured, which can be before a move that
    // was read here.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              const latest = entries[entries.length - 1];
              if (latest) {
                reported = { onScreen: isOnScreen(latest), at: latest.time };
              }
            },
            { threshold: THRESHOLDS },
          );
    observer?.observe(panel);
    // A scroll event does not leave the shadow tree it is sent in.
    const scrolled = scrollTargetsAround(panel);
    const views = windowsAround(panel);
    for (const target of scrolled) {
      target.addEventListener("scroll", measure, {
        capture: true,
        passive: true,
      });
    }
    for (const view of views) {
      view.addEventListener("resize", measure);
    }

    return () => {
      // The send has ended. What was read before the receipt counts.
      const measuredOnScreen = !measured.outOfSight;
      onScreenRef.current = !seesAll
        ? (reported?.onScreen ?? true) && measuredOnScreen
        : reported && reported.at > measured.at
          ? reported.onScreen
          : measuredOnScreen;
      observer?.disconnect();
      for (const target of scrolled) {
        target.removeEventListener("scroll", measure, { capture: true });
      }
      for (const view of views) {
        view.removeEventListener("resize", measure);
      }
    };
  }, [isSending, panelRef]);

  return useCallback(() => onScreenRef.current, []);
}
