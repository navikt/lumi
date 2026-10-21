import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { ApiErrorException, ErrorType } from "~/types/errors";

/** Login, team access, and a team lookup that is down. */
const ACCESS_ERROR_STATUSES = new Set([401, 403, 503]);

/**
 * The bootstrap error FilterBar explains with the API's own message, or
 * undefined for errors that only get the generic retry alert. A database that
 * does not answer is a 503 as well, but it says nothing about team access:
 * the page's own data may well have loaded, so it must stay visible.
 */
export function getTeamAccessError(
  error: unknown,
): ApiErrorException | undefined {
  return error instanceof ApiErrorException &&
    ACCESS_ERROR_STATUSES.has(error.error.status) &&
    error.error.type !== ErrorType.DATABASE_UNAVAILABLE
    ? error
    : undefined;
}

/**
 * The API's explanation when the database did not answer, for FilterBar's
 * generic alert. Undefined for other errors, which keep the default text.
 */
export function databaseUnavailableDescription(
  error: unknown,
): string | undefined {
  if (
    !(error instanceof ApiErrorException) ||
    error.error.type !== ErrorType.DATABASE_UNAVAILABLE
  ) {
    return undefined;
  }
  const { message, details } = error.error;
  return details ? `${message}. ${details}` : `${message}.`;
}

/**
 * True when FilterBar shows why the team's data cannot be fetched. The page
 * then skips its own data and error, so the viewer sees one alert. Shares the
 * FilterBar query.
 */
export function useTeamAccessDenied(): boolean {
  const { error } = useFilterBootstrap();
  return getTeamAccessError(error) !== undefined;
}
