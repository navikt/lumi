import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeIntersectionObserver,
  installFakeIntersectionObserver,
  nextFrame,
  observedElements,
  placeObserved,
  placeObservedAndReportLater,
  placeObservedBelowTheFold,
} from "../../__tests__/fakeIntersectionObserver.js";
import {
  useSightWhileSending,
  useViewportPresence,
} from "../useViewportPresence.js";

let presence: ReturnType<typeof useViewportPresence>;

const Probe = ({
  enabled = true,
  around,
}: {
  enabled?: boolean;
  /** Style of an element around the probe, for example a scroll area. */
  around?: CSSProperties;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  presence = useViewportPresence(ref, enabled);
  return (
    <div data-testid="around" style={around}>
      <div ref={ref} data-testid="probe" />
    </div>
  );
};

const probe = () => screen.getByTestId("probe");

/** The probe alone, for the tests that place it in another tree. */
const Target = () => {
  const ref = useRef<HTMLDivElement>(null);
  presence = useViewportPresence(ref, true);
  return <div ref={ref} />;
};

/** Renders `children` in an open shadow tree whose host is in a scroll area. */
const InShadowTree = ({ children }: { children: ReactNode }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const inner = document.createElement("div");
    host.attachShadow({ mode: "open" }).append(inner);
    setMount(inner);
  }, []);
  return (
    <div data-testid="around" style={{ overflowY: "auto" }}>
      <div ref={hostRef} />
      {mount ? createPortal(children, mount) : null}
    </div>
  );
};

/**
 * The probe as a child of a host whose shadow tree shows it in a slot, in a
 * scroll area of 220 pixels.
 */
const Slotted = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const shadow = hostRef.current?.attachShadow({ mode: "open" });
    if (!shadow) return;
    const area = document.createElement("div");
    area.style.overflowY = "auto";
    vi.spyOn(area, "clientHeight", "get").mockReturnValue(220);
    area.append(document.createElement("slot"));
    shadow.append(area);
  }, []);
  return (
    <div ref={hostRef}>
      <Target />
    </div>
  );
};

/** An iframe from the same site, appended to `parent`. */
const appendFrame = (parent: HTMLElement, innerHeight: number) => {
  const frame = document.createElement("iframe");
  parent.append(frame);
  const frameWindow = frame.contentWindow;
  if (!frameWindow?.document.body)
    throw new Error("The iframe has no document");
  vi.spyOn(frameWindow, "innerHeight", "get").mockReturnValue(innerHeight);
  vi.spyOn(frameWindow, "innerWidth", "get").mockReturnValue(1000);
  return frameWindow.document.body;
};

/** The time between two measurements, and the report that follows one. */
const nextSample = () => {
  act(() => {
    vi.advanceTimersByTime(250);
  });
  nextFrame();
};

// The stand-in's viewport is 1000 wide and 800 high, and the element is 600
// wide and 400 high unless a test says otherwise.
describe("useViewportPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The window is the stand-in's viewport, as in a page that is not framed.
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("seen", () => {
    it("counts the element as seen at once without IntersectionObserver", () => {
      render(<Probe />);

      expect(presence.seen).toBe(true);
    });

    it("waits until half of the element is on screen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      expect(observedElements()).toEqual([probe()]);
      expect(presence.seen).toBe(false);

      placeObservedBelowTheFold();
      // 120 of 400 pixels are above the bottom of the viewport.
      placeObserved({ top: 680 });
      expect(presence.seen).toBe(false);

      placeObserved({ top: 600 });
      expect(presence.seen).toBe(true);
    });

    it("counts a tall element as seen when it covers half of the viewport", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // Four viewports tall: half of it is never on screen.
      placeObserved({ top: 500, height: 3200 });
      expect(presence.seen).toBe(false);

      placeObserved({ top: 160, height: 3200 });
      expect(presence.seen).toBe(true);
    });

    it("counts a tall element when the user stops between two of the browser's steps", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // 380 and 420 of 1500 pixels are both between a quarter and three
      // tenths of the element, so the browser does not report the move. Half
      // of the viewport is 400 pixels.
      placeObserved({ top: 420, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 380, height: 1500 });
      expect(presence.seen).toBe(false);
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("counts a tall element that leaves through the top of the viewport", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // The user arrives at the end of the page, with the last 380 pixels of
      // the element on screen, and scrolls up.
      placeObserved({ top: -1120, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: -1080, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("counts an element so tall that the browser reports it only once", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // The first step is a twentieth of the element: 1000 pixels, more than
      // the viewport holds. The browser reports when the element comes on
      // screen, and then never again.
      placeObserved({ top: 790, height: 20000 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 390, height: 20000 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("counts an element wider than the viewport when it covers half of the width", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // 480 and 520 of 3000 pixels are between the same two steps.
      placeObserved({ left: 520, width: 3000 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ left: 480, width: 3000 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against a scroll area that is smaller than the viewport", () => {
      installFakeIntersectionObserver();
      render(<Probe around={{ overflowY: "auto" }} />);
      vi.spyOn(
        screen.getByTestId("around"),
        "clientHeight",
        "get",
      ).mockReturnValue(300);

      // The scroll area shows at most 300 pixels of the element. Half of the
      // viewport, 400 pixels, would never be on screen.
      placeObserved({ top: 660, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 640, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against what a scaled scroll area shows on screen", () => {
      installFakeIntersectionObserver();
      render(<Probe around={{ overflowY: "auto" }} />);
      const area = screen.getByTestId("around");
      // A scroll area of 300 pixels, scaled down to 120 on screen.
      vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
      vi.spyOn(area, "offsetHeight", "get").mockReturnValue(300);
      vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
        height: 120,
        width: 600,
      } as DOMRect);

      placeObserved({ top: 750, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      // 70 pixels: more than half of the 120 the user can see.
      placeObserved({ top: 730, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against what a scroll area scaled up shows on screen", () => {
      installFakeIntersectionObserver();
      render(<Probe around={{ overflowY: "auto" }} />);
      const area = screen.getByTestId("around");
      // A scroll area of 200 pixels with a border of 10, scaled to twice its
      // size: 400 of the pixels the observer measures in show its content.
      vi.spyOn(area, "clientHeight", "get").mockReturnValue(200);
      vi.spyOn(area, "offsetHeight", "get").mockReturnValue(220);
      vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
        height: 440,
        width: 600,
      } as DOMRect);

      placeObserved({ top: 620, height: 3000 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 580, height: 3000 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against a scroll area around the host of a shadow tree", () => {
      installFakeIntersectionObserver();
      render(
        <InShadowTree>
          <Target />
        </InShadowTree>,
      );
      vi.spyOn(
        screen.getByTestId("around"),
        "clientHeight",
        "get",
      ).mockReturnValue(220);

      placeObserved({ top: 710, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 690, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against a scroll area in the shadow tree it is slotted into", () => {
      installFakeIntersectionObserver();
      render(<Slotted />);

      placeObserved({ top: 710, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 690, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against the window of an iframe it is rendered into through a portal", () => {
      // The script runs in the page, whose window is 800 pixels high. The
      // survey is in an iframe that shows 200.
      installFakeIntersectionObserver();
      const frameBody = appendFrame(document.body, 200);
      try {
        render(createPortal(<Target />, frameBody));

        placeObserved({ top: 720, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 680, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        frameBody.ownerDocument.defaultView?.frameElement?.remove();
      }
    });

    it("measures against a scroll area in the page around an iframe", () => {
      installFakeIntersectionObserver();
      const area = document.createElement("div");
      area.style.overflowY = "auto";
      vi.spyOn(area, "clientHeight", "get").mockReturnValue(300);
      document.body.append(area);
      const frameBody = appendFrame(area, 600);
      try {
        render(createPortal(<Target />, frameBody));

        placeObserved({ top: 660, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 640, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        area.remove();
      }
    });

    it("measures against every window around it in nested iframes", () => {
      // The outer iframe shows 300 pixels of the inner one, which is 600 high.
      installFakeIntersectionObserver();
      const outerBody = appendFrame(document.body, 300);
      const innerBody = appendFrame(outerBody, 600);
      try {
        render(createPortal(<Target />, innerBody));

        placeObserved({ top: 660, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 640, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        outerBody.ownerDocument.defaultView?.frameElement?.remove();
      }
    });

    it("measures the viewport in the pixels of an iframe that a transform scales up", () => {
      // The page's window is 800 pixels high, and a transform shows the
      // iframe at twice its size. The viewport shows 400 of the iframe's
      // pixels, which are the pixels the observer measures the survey in.
      installFakeIntersectionObserver();
      const frameBody = appendFrame(document.body, 1700);
      const frame = frameBody.ownerDocument.defaultView
        ?.frameElement as HTMLIFrameElement;
      vi.spyOn(frame, "offsetHeight", "get").mockReturnValue(1700);
      vi.spyOn(frame, "offsetWidth", "get").mockReturnValue(500);
      vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
        height: 3400,
        width: 1000,
      } as DOMRect);
      try {
        render(createPortal(<Target />, frameBody));

        placeObserved({ top: 610, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 590, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        frame.remove();
      }
    });

    it("measures the screen in the pixels of an iframe that a transform scales up, in an iframe from another site", () => {
      // The outer iframe is from another site and 2500 pixels high: the
      // observer has no viewport to report, and the screen is 800 pixels
      // high. Inside it, an iframe from the same site is shown at twice its
      // size, so the screen shows 400 of its pixels.
      installFakeIntersectionObserver({ reportsRootBounds: false });
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(2500);
      vi.spyOn(window, "outerHeight", "get").mockReturnValue(0);
      vi.spyOn(window.screen, "height", "get").mockReturnValue(800);
      const frameBody = appendFrame(document.body, 1700);
      const frameWindow = frameBody.ownerDocument.defaultView as Window;
      const frame = frameWindow.frameElement as HTMLIFrameElement;
      vi.spyOn(frameWindow, "outerHeight", "get").mockReturnValue(0);
      vi.spyOn(frameWindow.screen, "height", "get").mockReturnValue(800);
      vi.spyOn(frame, "offsetHeight", "get").mockReturnValue(1700);
      vi.spyOn(frame, "offsetWidth", "get").mockReturnValue(500);
      vi.spyOn(frame, "getBoundingClientRect").mockReturnValue({
        height: 3400,
        width: 1000,
      } as DOMRect);
      try {
        render(createPortal(<Target />, frameBody));

        placeObserved({ top: 610, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 590, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        frame.remove();
      }
    });

    it("measures against its own window in an iframe that is lower than the viewport", () => {
      // An iframe from the same site: the observer reports the viewport of
      // the browser, 800 pixels, and the iframe shows 100.
      installFakeIntersectionObserver();
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(100);
      render(<Probe />);

      placeObserved({ top: 760, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 740, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against the viewport and not against <body> when the viewport takes over the overflow of <body>", () => {
      // `<body>` scrolls the page and is 100 pixels high, as with
      // `height: 100px`. What scrolls is the viewport.
      installFakeIntersectionObserver();
      document.body.style.overflowY = "auto";
      vi.spyOn(document.body, "clientHeight", "get").mockReturnValue(100);
      try {
        render(<Probe />);

        // Half of the viewport is 400 pixels.
        placeObserved({ top: 740, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(false);

        placeObserved({ top: 390, height: 1500 });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        document.body.style.overflowY = "";
      }
    });

    it("measures against the browser window in an iframe on a large screen", () => {
      // An iframe from another site, taller than the browser window, on a
      // screen much taller than the window.
      installFakeIntersectionObserver({ reportsRootBounds: false });
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(1700);
      vi.spyOn(window, "outerHeight", "get").mockReturnValue(700);
      vi.spyOn(window, "outerWidth", "get").mockReturnValue(1000);
      vi.spyOn(window.screen, "height", "get").mockReturnValue(2160);
      vi.spyOn(window.screen, "width", "get").mockReturnValue(3840);
      render(<Probe />);

      // Half of the browser window is 350 pixels.
      placeObserved({ top: 460, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 440, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("measures against the screen in an iframe that is taller than the browser window", () => {
      // An iframe from another site: the observer has no viewport to report.
      installFakeIntersectionObserver({ reportsRootBounds: false });
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(2400);
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
      // The browser does not say how large its window is.
      vi.spyOn(window, "outerHeight", "get").mockReturnValue(0);
      vi.spyOn(window, "outerWidth", "get").mockReturnValue(0);
      vi.spyOn(window.screen, "height", "get").mockReturnValue(800);
      vi.spyOn(window.screen, "width", "get").mockReturnValue(1000);
      render(<Probe />);

      // The iframe shows all 1500 pixels, but the browser window is no
      // taller than the screen. Half of the element could never be seen.
      placeObserved({ top: 420, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 380, height: 1500 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it("reads the size of the viewport from the window when the observer has none", () => {
      installFakeIntersectionObserver({ reportsRootBounds: false });
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
      vi.spyOn(window, "outerHeight", "get").mockReturnValue(0);
      vi.spyOn(window, "outerWidth", "get").mockReturnValue(0);
      render(<Probe />);

      // The observer measures against its own viewport of 800 pixels. Half of
      // the window is 300 pixels.
      placeObserved({ top: 550, height: 2400 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ top: 440, height: 2400 });
      nextSample();
      expect(presence.seen).toBe(true);
    });

    it.each([
      ["invisible", { visibility: "hidden" }, { visibility: "visible" }],
      ["fully transparent", { opacity: "0" }, { opacity: "0.2" }],
    ] as const)(
      "does not count an element in an element that is %s, until it can be seen",
      (_, hidden, shown) => {
        installFakeIntersectionObserver();
        render(<Probe around={hidden} />);

        // The whole element is on screen, where the browser places it.
        placeObserved();
        nextSample();
        expect(presence.seen).toBe(false);

        act(() => {
          Object.assign(screen.getByTestId("around").style, shown);
        });
        nextSample();
        expect(presence.seen).toBe(true);
      },
    );

    it("counts an element that is visible in an invisible element", () => {
      installFakeIntersectionObserver();
      render(<Probe around={{ visibility: "hidden" }} />);
      probe().style.visibility = "visible";

      placeObserved();
      expect(presence.seen).toBe(true);
    });

    it("does not count an element in an iframe that is invisible on the page around it", () => {
      installFakeIntersectionObserver();
      const frameBody = appendFrame(document.body, 800);
      const frame = frameBody.ownerDocument.defaultView
        ?.frameElement as HTMLIFrameElement;
      frame.style.visibility = "hidden";
      try {
        render(createPortal(<Target />, frameBody));

        placeObserved();
        nextSample();
        expect(presence.seen).toBe(false);

        act(() => {
          frame.style.visibility = "visible";
        });
        nextSample();
        expect(presence.seen).toBe(true);
      } finally {
        frame.remove();
      }
    });

    it("does not count an element while the page is in a tab in the background", () => {
      installFakeIntersectionObserver();
      const visibility = vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("hidden");
      render(<Probe />);

      placeObserved();
      expect(presence.seen).toBe(false);

      visibility.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      nextFrame();
      expect(presence.seen).toBe(true);
    });

    it("does not count an element that only touches the edge of the viewport", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      // All of its height is level with the viewport, and none of its width
      // is inside it.
      placeObserved({ left: 1000 });
      nextSample();

      expect(presence.seen).toBe(false);
    });

    it("needs half of the width too", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObserved({ left: 800 });
      nextSample();
      expect(presence.seen).toBe(false);

      placeObserved({ left: 700 });
      expect(presence.seen).toBe(true);
    });

    it("lets half a pixel pass, so a rounded size does not miss the limit", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObserved({ top: 600.4 });

      expect(presence.seen).toBe(true);
    });

    it("does not count an element that is a whole pixel short", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObserved({ top: 601 });
      nextSample();

      expect(presence.seen).toBe(false);
    });

    it("stays seen when the element leaves the screen again", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObserved();
      placeObservedBelowTheFold();

      expect(presence.seen).toBe(true);
    });

    it("can be marked as seen before the element is on screen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);
      placeObservedBelowTheFold();

      act(() => presence.markSeen());

      expect(presence.seen).toBe(true);
    });
  });

  describe("measuring again", () => {
    it("watches the area of the element in steps", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      expect(FakeIntersectionObserver.instances).toHaveLength(1);
      const [observer] = FakeIntersectionObserver.instances;
      expect(observer.thresholds[0]).toBe(0);
      expect(observer.thresholds).toContain(0.5);
      expect(observer.thresholds.at(-1)).toBe(1);
    });

    it("does not measure while the element is off screen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObservedBelowTheFold();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("measures while a part of the element is on screen and it has not counted", () => {
      installFakeIntersectionObserver();
      render(<Probe />);

      placeObserved({ top: 700 });
      expect(vi.getTimerCount()).toBe(1);

      // It keeps measuring for as long as the user stays there.
      nextSample();
      nextSample();
      expect(vi.getTimerCount()).toBe(1);
      expect(presence.seen).toBe(false);
    });

    it("stops measuring when the element has counted as seen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);
      placeObserved({ top: 700 });

      placeObserved();

      expect(presence.seen).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops measuring when the element leaves the screen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);
      placeObserved({ top: 700 });

      placeObservedBelowTheFold();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops measuring when the element is marked as seen", () => {
      installFakeIntersectionObserver();
      render(<Probe />);
      placeObserved({ top: 700 });

      act(() => presence.markSeen());
      nextSample();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not measure again for a report the browser delivers after it unmounts", () => {
      installFakeIntersectionObserver();
      const { unmount } = render(<Probe />);
      const report = placeObservedAndReportLater({ top: 700 });

      unmount();
      report();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops measuring when it unmounts", () => {
      installFakeIntersectionObserver();
      const { unmount } = render(<Probe />);
      placeObserved({ top: 700 });

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(observedElements()).toEqual([]);
    });
  });

  describe("observing", () => {
    it("does not observe while the element is not rendered", () => {
      installFakeIntersectionObserver();
      const { rerender } = render(<Probe enabled={false} />);

      expect(observedElements()).toEqual([]);

      rerender(<Probe enabled />);
      expect(observedElements()).toEqual([probe()]);
    });
  });
});

let isOnScreen: () => boolean;

/** A panel that is sent while `sending` is true. */
const Sending = ({ sending }: { sending: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  isOnScreen = useSightWhileSending(ref, sending);
  return <div ref={ref} data-testid="panel" />;
};

describe("useSightWhileSending", () => {
  const panel = () => screen.getByTestId("panel");
  /** Puts the panel from `top` to `bottom` on screen. */
  const placePanel = (top: number, bottom: number) =>
    vi.spyOn(panel(), "getBoundingClientRect").mockReturnValue({
      top,
      bottom,
      left: 100,
      right: 700,
      width: 600,
      height: bottom - top,
      x: 100,
      y: top,
      toJSON: () => ({}),
    });
  /** A send from start to end, with what happens while the answer is sent. */
  const send = (whileSending: () => void) => {
    const { rerender, unmount } = render(<Sending sending={false} />);
    rerender(<Sending sending />);
    whileSending();
    rerender(<Sending sending={false} />);
    unmount();
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is true before any send", () => {
    render(<Sending sending={false} />);

    expect(isOnScreen()).toBe(true);
  });

  it("reads where the panel is when the page moves, also without IntersectionObserver", () => {
    send(() => {
      placePanel(-900, -500);
      fireEvent.scroll(window);
    });
    expect(isOnScreen()).toBe(false);

    send(() => {
      placePanel(-900, 1);
      fireEvent.scroll(window);
    });
    expect(isOnScreen()).toBe(true);
  });

  it("lets the newer reading count", () => {
    installFakeIntersectionObserver();
    // The browser reports the panel on screen, and then the page moves it to
    // rest against the top of the viewport.
    send(() => {
      placeObserved({ top: -399 });
      placePanel(-400, 0);
      fireEvent.scroll(window);
    });
    expect(isOnScreen()).toBe(false);

    // The page moves the panel off screen, and the browser then reports it
    // back on screen, as when content above it closes.
    send(() => {
      placePanel(-900, -500);
      fireEvent.scroll(window);
      placeObserved({ top: -100 });
    });
    expect(isOnScreen()).toBe(true);
  });

  it("lets a move count over a report the browser measured before it", () => {
    installFakeIntersectionObserver();
    // The browser measures two pixels of the panel on screen, and reports it
    // after the page has moved the panel to rest against the edge.
    send(() => {
      const report = placeObservedAndReportLater({ top: -398 });
      placePanel(-400, 0);
      fireEvent.scroll(window);
      report();
    });

    expect(isOnScreen()).toBe(false);
  });

  it("needs both readings in an iframe from another site, which cannot read the page around it", () => {
    installFakeIntersectionObserver();
    vi.spyOn(window, "parent", "get").mockReturnValue({} as Window);
    // The page around the iframe has moved it off screen, and the page in
    // the iframe then moves a little.
    send(() => {
      placeObserved({ top: -900 });
      placePanel(100, 500);
      fireEvent.scroll(window);
    });

    expect(isOnScreen()).toBe(false);
  });
});
