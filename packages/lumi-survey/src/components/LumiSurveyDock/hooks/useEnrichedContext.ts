import { useEffect, useMemo, useState } from "react";
import type { DeviceType, LumiSurveyContext } from "../../../core/types.js";

/**
 * Derives device type from viewport width.
 */
function getDeviceType(width: number): DeviceType {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

const LUMI_SURVEY_NAVIGATION_EVENT = "lumi-survey:navigation";

let historyPatched = false;

function ensureHistoryPatched(): void {
  if (historyPatched) return;
  if (typeof window === "undefined") return;

  historyPatched = true;

  const notify = () => {
    window.dispatchEvent(new Event(LUMI_SURVEY_NAVIGATION_EVENT));
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

export interface EnrichedContextOptions {
  /** Opt-in: auto-collect current pathname from the browser. */
  collectLocation?: boolean;
}

/**
 * Hook that enriches user-provided context with auto-collected browser data.
 * Note: This hook is client-only - the widget is never server-rendered.
 *
 * @param userContext - Optional user-provided context (app, tags, debug)
 * @returns Enriched context with system fields (viewport, deviceType, userAgent)
 */
export function useEnrichedContext(
  userContext?: LumiSurveyContext,
  options?: EnrichedContextOptions,
): LumiSurveyContext {
  const shouldCollectLocation = options?.collectLocation ?? false;

  const [location, setLocation] = useState(() => {
    if (!shouldCollectLocation) return { pathname: undefined };
    return {
      pathname: window.location.pathname,
    };
  });

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    if (!shouldCollectLocation) return;
    ensureHistoryPatched();

    const updateLocation = () => {
      setLocation({
        pathname: window.location.pathname,
      });
    };

    updateLocation();

    window.addEventListener(LUMI_SURVEY_NAVIGATION_EVENT, updateLocation);
    window.addEventListener("popstate", updateLocation);
    window.addEventListener("hashchange", updateLocation);
    return () => {
      window.removeEventListener(LUMI_SURVEY_NAVIGATION_EVENT, updateLocation);
      window.removeEventListener("popstate", updateLocation);
      window.removeEventListener("hashchange", updateLocation);
    };
  }, [shouldCollectLocation]);

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

  return useMemo((): LumiSurveyContext => {
    return {
      // System-collected
      viewport,
      deviceType: getDeviceType(viewport.width),
      userAgent: navigator.userAgent,
      // User-provided
      // NOTE: url/pathname are opt-in. If you enable auto-collection, make sure
      // your routes do not include identifiers. Prefer passing a sanitized
      // route key/template explicitly.
      url: userContext?.url,
      pathname:
        userContext?.pathname ??
        (shouldCollectLocation ? location.pathname : undefined),
      tags: userContext?.tags,
      debug: userContext?.debug,
    };
  }, [
    location.pathname,
    shouldCollectLocation,
    userContext?.pathname,
    userContext?.url,
    userContext?.debug,
    userContext?.tags,
    viewport,
  ]);
}
