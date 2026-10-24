import { useEffect, useState } from "react";

const NETWORK_INITIATORS = new Set(["fetch", "xmlhttprequest", "beacon"]);

/** Calls the dev server makes for itself and for comment mode, never the widget. */
const DEV_ONLY = ["/__kommentarer", "/@vite/", "/@fs/", "/node_modules/.vite/"];

function isNetworkCall(entry: PerformanceEntry, since: number): boolean {
  return (
    entry.startTime >= since &&
    NETWORK_INITIATORS.has(
      (entry as PerformanceResourceTiming).initiatorType,
    ) &&
    !DEV_ONLY.some((path) => entry.name.includes(path))
  );
}

/**
 * Requests the page has made with fetch, XHR or sendBeacon since `active`
 * turned true, measured by the browser's resource timing. Fonts, images and
 * style sheets are not counted.
 */
export function useNetworkCalls(active: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active || typeof PerformanceObserver === "undefined") return;
    const since = performance.now();
    setCount(0);
    const observer = new PerformanceObserver((list) => {
      const added = list
        .getEntries()
        .filter((entry) => isNetworkCall(entry, since)).length;
      if (added > 0) setCount((current) => current + added);
    });
    try {
      observer.observe({ type: "resource", buffered: false });
    } catch {
      return;
    }
    return () => observer.disconnect();
  }, [active]);

  return count;
}
