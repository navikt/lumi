import { useLayoutEffect, useRef, useState } from "react";
import { useRenderMode } from "../../engine";

/**
 * True when the build steps of a slide should move: it is the presented
 * slide on the stage, and it came on at step 0. Coming back to it from the
 * next slide, or opening it at a later step, shows each step's end state at
 * once, and so do thumbnails, the presenter preview and the PDF.
 */
export function useBuildMotion(step: number, active: boolean): boolean {
  const stage = useRenderMode() === "stage";
  const [arrivedAt, setArrivedAt] = useState<number | null>(
    active ? step : null,
  );
  const wasActive = useRef(active);
  useLayoutEffect(() => {
    if (active === wasActive.current) return;
    wasActive.current = active;
    setArrivedAt(active ? step : null);
  }, [active, step]);
  return stage && active && arrivedAt === 0;
}
