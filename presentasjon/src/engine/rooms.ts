import type { Room, Slide } from "./types";

export const ROOM_PARAM = "rom";

const ROOMS: readonly Room[] = ["faggruppa", "frontend", "produktledere"];

function isRoom(value: string | null): value is Room {
  return value !== null && (ROOMS as readonly string[]).includes(value);
}

/** `?rom=faggruppa` and so on. Unknown values mean every slide. */
export function readRoom(search: string): Room | null {
  const value = new URLSearchParams(search).get(ROOM_PARAM);
  return isRoom(value) ? value : null;
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
