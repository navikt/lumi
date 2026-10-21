import { ROOM_PARAM } from "./rooms";

export type ViewMode = "audience" | "presenter" | "print";

export const PRESENTER_WINDOW_NAME = "lumi-presentasjon-presentator";

/** `?presenter` and `?print` select the view; anything else is the deck. */
export function readViewMode(search: string): ViewMode {
  const params = new URLSearchParams(search);
  if (params.has("print")) return "print";
  if (params.has("presenter")) return "presenter";
  return "audience";
}

/** Same deck, room and position, presenter view. */
export function presenterUrl(): string {
  const url = new URL(window.location.href);
  const room = url.searchParams.get(ROOM_PARAM);
  url.search = room
    ? `?presenter&${ROOM_PARAM}=${encodeURIComponent(room)}`
    : "?presenter";
  return url.toString();
}
