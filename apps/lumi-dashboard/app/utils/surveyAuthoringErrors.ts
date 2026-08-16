/**
 * Distinguishes an optimistic-locking conflict from transient save errors.
 * Both the API ("Draft changed since it was loaded. Reload before saving
 * again.") and the mock ("Draft changed since it was loaded") signal the
 * conflict in the message — the only shape that survives the server-function
 * serialization boundary. Conflicts freeze the editor; anything else is
 * retried.
 */
export function isDraftConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Draft changed");
}

const RETRYABLE_PATTERN =
  /fetch failed|failed to fetch|network|load failed|timeout|timed out|econn|socket|aborted|429|too many requests|500|502|503|504|internal server error|bad gateway|service unavailable|gateway timeout/i;

/**
 * Whether an autosave failure is worth retrying automatically. Only
 * network-ish failures, 429 and 5xx qualify; permanent errors (validation,
 * auth, not found) surface immediately with their actual message.
 */
export function isRetryableSaveError(error: unknown): boolean {
  if (isDraftConflictError(error)) return false;
  if (!(error instanceof Error)) return false;
  return RETRYABLE_PATTERN.test(error.message);
}
