import { createContext, useContext } from "react";
import type { RenderMode } from "./types";

export interface SlideContextValue {
  slideId: string;
  step: number;
  active: boolean;
  mode: RenderMode;
}

export const SlideContext = createContext<SlideContextValue | null>(null);

/** Step, active state and render mode of the surrounding slide. */
export function useSlide(): SlideContextValue {
  const value = useContext(SlideContext);
  if (!value) {
    throw new Error("useSlide kan bare brukes inne i et lysbilde.");
  }
  return value;
}

/** Render mode of the surrounding slide, or "stage" outside a slide. */
export function useRenderMode(): RenderMode {
  return useContext(SlideContext)?.mode ?? "stage";
}
