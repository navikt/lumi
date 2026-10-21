import type { DeckPosition, Slide } from "./types";

/** The last build step of a slide. The initial state is step 0. */
export function lastStepOf(slide: Slide | undefined): number {
  const steps = slide?.steps ?? 0;
  return Number.isFinite(steps) && steps > 0 ? Math.floor(steps) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampPosition(
  slides: readonly Slide[],
  position: DeckPosition,
): DeckPosition {
  const index = clamp(
    Math.trunc(position.index) || 0,
    0,
    Math.max(0, slides.length - 1),
  );
  const step = clamp(
    Math.trunc(position.step) || 0,
    0,
    lastStepOf(slides[index]),
  );
  return { index, step };
}

export function samePosition(a: DeckPosition, b: DeckPosition): boolean {
  return a.index === b.index && a.step === b.step;
}

/** Next build step, or the first step of the next slide. */
export function nextPosition(
  slides: readonly Slide[],
  position: DeckPosition,
): DeckPosition {
  const { index, step } = position;
  if (step < lastStepOf(slides[index])) return { index, step: step + 1 };
  if (index < slides.length - 1) return { index: index + 1, step: 0 };
  return position;
}

/** Previous build step, or the last step of the previous slide. */
export function previousPosition(
  slides: readonly Slide[],
  position: DeckPosition,
): DeckPosition {
  const { index, step } = position;
  if (step > 0) return { index, step: step - 1 };
  if (index > 0)
    return { index: index - 1, step: lastStepOf(slides[index - 1]) };
  return position;
}

/** Where "next" leads, or null at the end of the deck. */
export function upcomingPosition(
  slides: readonly Slide[],
  position: DeckPosition,
): DeckPosition | null {
  const next = nextPosition(slides, position);
  return samePosition(next, position) ? null : next;
}

export function formatHash(
  slides: readonly Slide[],
  position: DeckPosition,
): string {
  const slide = slides[position.index];
  if (!slide) return "";
  return position.step > 0 ? `#/${slide.id}/${position.step}` : `#/${slide.id}`;
}

/** Reads `#/<id>` or `#/<id>/<step>`. Unknown ids give null. */
export function parseHash(
  slides: readonly Slide[],
  hash: string,
): DeckPosition | null {
  const match = /^#\/([^/]+)(?:\/(\d+))?\/?$/.exec(hash);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const index = slides.findIndex((slide) => slide.id === id);
  if (index === -1) return null;
  return clampPosition(slides, { index, step: Number(match[2] ?? 0) });
}
