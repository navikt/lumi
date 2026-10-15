import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { ApiErrorException } from "~/types/errors";

/** Login, team access, and a team lookup that is down. */
const ACCESS_ERROR_STATUSES = new Set([401, 403, 503]);

/**
 * The bootstrap error FilterBar explains with the API's own message, or
 * undefined for errors that only get the generic retry alert.
 */
export function getTeamAccessError(
  error: unknown,
): ApiErrorException | undefined {
  return error instanceof ApiErrorException &&
    ACCESS_ERROR_STATUSES.has(error.error.status)
    ? error
    : undefined;
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
