import { useLayoutEffect, useMemo, useRef } from "react";
import { SlideContext, type SlideContextValue } from "./SlideContext";
import { SlideErrorBoundary } from "./SlideErrorBoundary";
import type { RenderMode, Slide } from "./types";

export interface SlideFrameProps {
  slide: Slide;
  index: number;
  total: number;
  step: number;
  active: boolean;
  mode: RenderMode;
  /** Mounted but not shown: a neighbour kept ready on the stage. */
  hidden?: boolean;
  /** Which side of the presented slide a neighbour is on. */
  side?: "before" | "after";
  /** Change to or from this slide without a transition. */
  cut?: boolean;
}

export function SlideFrame({
  slide,
  index,
  total,
  step,
  active,
  mode,
  hidden = false,
  side,
  cut = false,
}: SlideFrameProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const context = useMemo<SlideContextValue>(
    () => ({ slideId: slide.id, step, active, mode }),
    [slide.id, step, active, mode],
  );

  // `data-from="n"`: shown from step n. Evaluated when the step changes.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    for (const element of section.querySelectorAll<HTMLElement>(
      "[data-from]",
    )) {
      const from = Number(element.dataset.from);
      element.toggleAttribute(
        "data-revealed",
        Number.isFinite(from) && step >= from,
      );
    }
  }, [step]);

  // Only the presented slide on the stage takes focus and pointer input.
  const interactive = mode === "print" || (mode === "stage" && !hidden);
  const { Component } = slide;

  return (
    <section
      ref={sectionRef}
      className="deck-slide"
      aria-roledescription="lysbilde"
      aria-label={`${index + 1} av ${total}: ${slide.title}`}
      data-slide-id={slide.id}
      data-hidden={hidden ? "" : undefined}
      data-side={side}
      data-cut={cut ? "" : undefined}
      data-kapittel={slide.chapter}
      inert={!interactive}
    >
      <SlideContext value={context}>
        <SlideErrorBoundary slideId={slide.id}>
          <Component step={step} active={active} />
        </SlideErrorBoundary>
      </SlideContext>
    </section>
  );
}
