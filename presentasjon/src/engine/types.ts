import type { ReactNode } from "react";

/** Props every slide component receives. */
export interface SlideProps {
  /** Current build step, from 0 up to and including the slide's `steps`. */
  step: number;
  /** True while this slide is the one being presented. */
  active: boolean;
}

/** The rooms the talk is given in. `?rom=<room>` picks the slides for one. */
export type Room = "faggruppa" | "frontend" | "produktledere";

/** One slide. The deck shows slides in array order. */
export interface Slide {
  /** URL-safe id, used in the hash: `#/<id>` and `#/<id>/<step>`. */
  id: string;
  title: string;
  /** Build steps after the initial state. Defaults to 0. */
  steps?: number;
  /** Speaker notes for the presenter view. Line breaks are kept. */
  notes?: string;
  /** Rooms that get this slide. Leave out to show it in every room. */
  rooms?: readonly Room[];
  /**
   * Shown only when its room is picked, not on the link without `?rom`.
   * For slides that only make sense live, like an opening hook.
   */
  roomOnly?: boolean;
  /**
   * Cut straight in from the slide before, without a transition. For a
   * slide that continues the one before, like the same map with one change.
   */
  cut?: boolean;
  Component: (props: SlideProps) => ReactNode;
}

/**
 * Where a slide is rendered: the audience stage, an overview thumbnail,
 * a presenter preview or the print view.
 */
export type RenderMode = "stage" | "thumbnail" | "preview" | "print";

export interface DeckPosition {
  index: number;
  step: number;
}
