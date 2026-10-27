import { cx } from "./css";
import { FittedStage } from "./FittedStage";
import { SlideFrame } from "./SlideFrame";
import type { DeckPosition, Slide } from "./types";

export interface SlidePreviewProps {
  slides: readonly Slide[];
  position: DeckPosition;
  className?: string;
}

/** A scaled and inert thumbnail of one slide at a given step. */
export function SlidePreview({
  slides,
  position,
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
        active={false}
        mode="thumbnail"
      />
    </FittedStage>
  );
}
