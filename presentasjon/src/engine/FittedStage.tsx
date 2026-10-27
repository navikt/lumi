import { type ReactNode, type Ref, useRef } from "react";
import { cssVars, cx } from "./css";
import { useElementSize } from "./useElementSize";

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface FittedStageProps {
  children: ReactNode;
  className?: string;
  stageRef?: Ref<HTMLDivElement>;
  /** Lets script move focus to the stage, out of slide content. */
  focusable?: boolean;
  /** A copy for previews: hidden from assistive technology, never focused. */
  preview?: boolean;
}

/** A 1920×1080 stage, scaled to fit its container and centred in it. */
export function FittedStage({
  children,
  className,
  stageRef,
  focusable = false,
  preview = false,
}: FittedStageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(boxRef);
  const scale = size
    ? Math.min(size.width / STAGE_WIDTH, size.height / STAGE_HEIGHT)
    : 0;

  return (
    <div
      ref={boxRef}
      className={cx("deck-fit", className)}
      style={cssVars({ "--deck-stage-scale": scale })}
      aria-hidden={preview || undefined}
      inert={preview}
    >
      <div
        ref={stageRef}
        className="deck-stage"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
        tabIndex={focusable ? -1 : undefined}
        data-deck-stage=""
      >
        {children}
      </div>
    </div>
  );
}
