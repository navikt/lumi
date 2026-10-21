import { useEffect, useState } from "react";

const NETWORK_INITIATORS = new Set(["fetch", "xmlhttprequest", "beacon"]);

function isNetworkCall(entry: PerformanceEntry, since: number): boolean {
  return (
    entry.startTime >= since &&
    NETWORK_INITIATORS.has((entry as PerformanceResourceTiming).initiatorType)
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
