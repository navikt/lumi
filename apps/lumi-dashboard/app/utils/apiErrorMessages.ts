/** Safe to show after the server-function boundary, where only the message remains. */
export const LUMI_API_READ_TIMEOUT_MESSAGE =
  "Lumi API brukte for lang tid. Prøv igjen om litt.";

/** Safe to show after the server-function boundary, where only the message remains. */
export const LUMI_API_WRITE_TIMEOUT_MESSAGE =
  "Lumi API brukte for lang tid. Endringen kan ha blitt lagret. Last siden på nytt før du prøver igjen.";

/**
 * Safe to show after the server-function boundary. A write got an answer
 * that is not what it asked for, such as a page from a proxy, so the change
 * may have been made.
 */
export const UNREADABLE_WRITE_ANSWER_MESSAGE =
  "Svaret fra Lumi kunne ikke leses. Endringen kan ha blitt lagret. Last siden på nytt før du prøver igjen.";

export function isLumiApiWriteTimeoutError(error: unknown): error is Error {
  return (
    error instanceof Error && error.message === LUMI_API_WRITE_TIMEOUT_MESSAGE
  );
}
