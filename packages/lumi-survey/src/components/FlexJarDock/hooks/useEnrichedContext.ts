import { useEffect, useMemo, useState } from "react";
import type { DeviceType, FlexjarContext } from "../../../core/types.js";

/**
 * Derives device type from viewport width.
 */
function getDeviceType(width: number): DeviceType {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

const LUMI_NAVIGATION_EVENT = "lumi:navigation";
const LEGACY_FLEXJAR_NAVIGATION_EVENT = "flexjar:navigation";

let historyPatched = false;

function ensureHistoryPatched(): void {
  if (historyPatched) return;
  if (typeof window === "undefined") return;

  historyPatched = true;

  const notify = () => {
    window.dispatchEvent(new Event(LUMI_NAVIGATION_EVENT));
    window.dispatchEvent(new Event(LEGACY_FLEXJAR_NAVIGATION_EVENT));
  };

  type PushState = History["pushState"];
  type ReplaceState = History["replaceState"];

  const originalPushState: PushState = window.history.pushState.bind(
    window.history,
  );
  window.history.pushState = (
    ...args: Parameters<PushState>
  ): ReturnType<PushState> => {
    const result = originalPushState(...args);
    notify();
    return result;
  };

  const originalReplaceState: ReplaceState = window.history.replaceState.bind(
    window.history,
  );
  window.history.replaceState = (
    ...args: Parameters<ReplaceState>
  ): ReturnType<ReplaceState> => {
    const result = originalReplaceState(...args);
    notify();
    return result;
  };
}

/**
 * Hook that enriches user-provided context with auto-collected browser data.
 * Note: This hook is client-only - the widget is never server-rendered.
 *
 * @param userContext - Optional user-provided context (app, tags, debug)
 * @returns Enriched context with system fields (url, pathname, viewport, deviceType, userAgent)
 */
export function useEnrichedContext(
  userContext?: FlexjarContext,
): FlexjarContext {
  const [location, setLocation] = useState(() => ({
    url: window.location.href,
    pathname: window.location.pathname,
  }));

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    ensureHistoryPatched();

    const updateLocation = () => {
      setLocation({
        url: window.location.href,
        pathname: window.location.pathname,
      });
    };

    window.addEventListener(LUMI_NAVIGATION_EVENT, updateLocation);
    window.addEventListener(LEGACY_FLEXJAR_NAVIGATION_EVENT, updateLocation);
    window.addEventListener("popstate", updateLocation);
    window.addEventListener("hashchange", updateLocation);

    return () => {
      window.removeEventListener(LUMI_NAVIGATION_EVENT, updateLocation);
      window.removeEventListener(
        LEGACY_FLEXJAR_NAVIGATION_EVENT,
        updateLocation,
      );
      window.removeEventListener("popstate", updateLocation);
      window.removeEventListener("hashchange", updateLocation);
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  return useMemo((): FlexjarContext => {
    return {
      // System-collected
      url: location.url,
      pathname: location.pathname,
      viewport,
      deviceType: getDeviceType(viewport.width),
      userAgent: navigator.userAgent,
      // User-provided
      tags: userContext?.tags,
      debug: userContext?.debug,
    };
  }, [
    location.pathname,
    location.url,
    userContext?.debug,
    userContext?.tags,
    viewport,
  ]);
}
