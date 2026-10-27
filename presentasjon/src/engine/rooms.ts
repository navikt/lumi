import type { Room, Slide } from "./types";

export const ROOM_PARAM = "rom";

const ROOMS: readonly Room[] = ["faggruppa", "frontend", "produktledere"];

/** The talk the address without `?rom` shows. */
const DEFAULT_ROOM: Room = "faggruppa";

function isRoom(value: string | null): value is Room {
  return value !== null && (ROOMS as readonly string[]).includes(value);
}

/** `?rom=faggruppa` and so on. Unknown values mean every slide. */
export function readRoom(search: string): Room | null {
  const value = new URLSearchParams(search).get(ROOM_PARAM);
  return isRoom(value) ? value : null;
}

/**
 * The room whose slides the address shows: the one in `?rom`, and the
 * talk for faggruppa without `?rom`. An unknown room means every slide.
 */
export function roomForSlides(search: string): Room | null {
  if (!new URLSearchParams(search).has(ROOM_PARAM)) return DEFAULT_ROOM;
  return readRoom(search);
}

/**
 * The slides for one room, in deck order. Without a room, every slide
 * except those marked `roomOnly`.
 */
export function slidesForRoom(
  slides: readonly Slide[],
  room: Room | null,
): readonly Slide[] {
  if (!room) return slides.filter((slide) => !slide.roomOnly);
  return slides.filter((slide) => !slide.rooms || slide.rooms.includes(room));
}
