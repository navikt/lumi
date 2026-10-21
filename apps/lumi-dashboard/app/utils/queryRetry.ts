import { ApiErrorException, ErrorType } from "~/types/errors";

/**
 * Default retry rule for the dashboard's queries. A network failure or an
 * unexpected error gets one more attempt. A structured answer from Lumi API
 * does not when a retry a second later cannot help:
 * - 4xx: a missing login, team access or a bad request does not change.
 * - DATABASE_UNAVAILABLE: the database timed out or had no free connection.
 *   A new attempt runs the same heavy query again against a busy database.
 *
 * Other 503 answers, such as a failed team lookup in Nais, are usually brief
 * and keep their retry. The user can always retry from the error message.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (error instanceof ApiErrorException) {
    const { status, type } = error.error;
    if (status >= 400 && status < 500) return false;
    if (type === ErrorType.DATABASE_UNAVAILABLE) return false;
  }
  return failureCount < 1;
}
