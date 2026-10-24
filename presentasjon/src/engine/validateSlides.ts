import type { Slide } from "./types";

const SLIDE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Fails fast on slide lists the hash and the sync cannot handle. */
export function assertValidSlides(slides: readonly Slide[]): void {
  if (slides.length === 0) {
    throw new Error("Presentasjonen har ingen lysbilder.");
  }
  const seen = new Set<string>();
  for (const slide of slides) {
    if (!SLIDE_ID.test(slide.id)) {
      throw new Error(
        `Ugyldig lysbilde-id «${slide.id}». Bruk små bokstaver, tall og bindestrek.`,
      );
    }
    if (seen.has(slide.id)) {
      throw new Error(`Lysbilde-id «${slide.id}» er brukt mer enn én gang.`);
    }
    seen.add(slide.id);
  }
}
