import { parseHash } from "./navigation";
import { ROOM_PARAM, slidesForRoom } from "./rooms";
import type { Slide } from "./types";

/** The deck, and the deck laid out for print. */
export type DeckView = "audience" | "print";

/** What the address opens: the deck, the phone page or the front page. */
export type ViewMode = DeckView | "trial" | "menu";

/**
 * `?prov` is the phone page and `?print` the print view. `?rom` opens the
 * deck, and so does a slide in the hash, so an old link like `#/lumi/2`
 * still opens the deck with every slide. Anything else is the front page.
 */
export function readViewMode(
  search: string,
  hash: string,
  slides: readonly Slide[],
): ViewMode {
  const params = new URLSearchParams(search);
  if (params.has("prov")) return "trial";
  if (params.has("print")) return "print";
  if (params.has(ROOM_PARAM)) return "audience";
  return parseHash(slidesForRoom(slides, null), hash) ? "audience" : "menu";
}
