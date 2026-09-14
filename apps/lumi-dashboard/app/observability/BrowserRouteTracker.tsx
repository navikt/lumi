import { isInitialized, pushEvent } from "@nais/apm";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  isBrowserObservabilityEnabled,
  normalizeBrowserPath,
} from "~/observability/browser";

export function BrowserRouteTracker() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const enabled = isBrowserObservabilityEnabled() && isInitialized();
  const pageId = normalizeBrowserPath(pathname);

  useEffect(() => {
    if (!enabled) return;
    pushEvent("route_change", { toRoute: pageId, toUrl: pageId });
  }, [enabled, pageId]);

  return null;
}
