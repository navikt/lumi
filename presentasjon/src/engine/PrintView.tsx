import { useEffect, useState } from "react";
import { cssVars } from "./css";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./FittedStage";
import { lastStepOf } from "./navigation";
import { removeAkselPrintLayer } from "./printStyles";
import { SlideFrame } from "./SlideFrame";
import type { Slide } from "./types";

const SCREEN_GUTTER = 48;

function screenScale(): number {
  return Math.min(1, (window.innerWidth - SCREEN_GUTTER) / STAGE_WIDTH);
}

interface PrintViewProps {
  slides: readonly Slide[];
}

/**
 * Print view (`?print`): every slide at its last step, one per
 * 1920×1080 page. On screen the pages are scaled down to fit.
 */
export function PrintView({ slides }: PrintViewProps) {
  const [scale, setScale] = useState(screenScale);

  useEffect(() => {
    const onResize = () => setScale(screenScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    removeAkselPrintLayer();
    window.addEventListener("beforeprint", removeAkselPrintLayer);
    return () =>
      window.removeEventListener("beforeprint", removeAkselPrintLayer);
  }, []);

  return (
    <div
      className="deck-print"
      style={cssVars({ "--deck-print-screen-scale": scale })}
    >
      <div className="deck-print__toolbar">
        <p className="deck-print__hint">
          {slides.length} lysbilder, ett per side. Skriv ut og velg «Lagre som
          PDF».
        </p>
        <button
          type="button"
          className="deck-button"
          onClick={() => window.print()}
        >
          Skriv ut
        </button>
      </div>
      {slides.map((slide, index) => (
        <div key={slide.id} className="deck-print__page">
          <div
            className="deck-stage deck-print__stage"
            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
          >
            <SlideFrame
              slide={slide}
              index={index}
              total={slides.length}
              step={lastStepOf(slide)}
              active
              mode="print"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
