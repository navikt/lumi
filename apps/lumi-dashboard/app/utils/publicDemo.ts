import { LUMI_API_WRITE_TIMEOUT_MESSAGE } from "./apiErrorMessages";

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
 * Preserve known safe write errors after serialization, without showing
 * arbitrary server messages that may contain user data.
 */
export function writeErrorText(error: unknown, fallback: string): string {
  if (isPublicDemoReadOnlyError(error)) return PUBLIC_DEMO_READ_ONLY_TEXT;
  if (
    error instanceof Error &&
    error.message === LUMI_API_WRITE_TIMEOUT_MESSAGE
  )
    return LUMI_API_WRITE_TIMEOUT_MESSAGE;
  return fallback;
}
