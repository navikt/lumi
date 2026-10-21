import { cx } from "./css";
import { FittedStage } from "./FittedStage";
import { SlideFrame } from "./SlideFrame";
import type { DeckPosition, Slide } from "./types";

export interface SlidePreviewProps {
  slides: readonly Slide[];
  position: DeckPosition;
  mode: "thumbnail" | "preview";
  /** Mirror of the presented slide, as opposed to a look ahead. */
  active?: boolean;
  className?: string;
}

/** A live, scaled and inert copy of one slide at a given step. */
export function SlidePreview({
  slides,
  position,
  mode,
  active = false,
  className,
}: SlidePreviewProps) {
  const slide = slides[position.index];
  if (!slide) return null;
  return (
    <FittedStage className={cx("deck-preview", className)} preview>
      <SlideFrame
        key={slide.id}
        slide={slide}
        index={position.index}
        total={slides.length}
        step={position.step}
        active={active}
        mode={mode}
      />
    </FittedStage>
  );
}
