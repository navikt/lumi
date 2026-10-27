export type ViewMode = "audience" | "print";

/** `?print` selects the print view; anything else is the deck. */
export function readViewMode(search: string): ViewMode {
  return new URLSearchParams(search).has("print") ? "print" : "audience";
}
