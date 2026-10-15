/**
 * Raised by every write the public demo refuses. Written for the reader
 * because several views show save errors as they are; the message is also
 * how the client recognizes the refusal after the server-function boundary.
 */
export const PUBLIC_DEMO_READ_ONLY_MESSAGE = "Demoen lagrer ikke endringer";

/** The refusal as a sentence of its own. */
export const PUBLIC_DEMO_READ_ONLY_TEXT = `${PUBLIC_DEMO_READ_ONLY_MESSAGE}.`;

export function isPublicDemoReadOnlyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(PUBLIC_DEMO_READ_ONLY_MESSAGE)
  );
}

/**
 * The text a view shows for a failed write: the demo refusal when that is
 * the cause, otherwise the view's own message.
 */
export function writeErrorText(error: unknown, fallback: string): string {
  return isPublicDemoReadOnlyError(error)
    ? PUBLIC_DEMO_READ_ONLY_TEXT
    : fallback;
}
