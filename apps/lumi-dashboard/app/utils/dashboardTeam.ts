import { redirect } from "@tanstack/react-router";
import { fetchFilterBootstrapServerFn } from "~/server/actions";
import { ApiErrorException } from "~/types/errors";
import { applyDashboardSearchDefaults } from "~/utils/dashboardSearchDefaults";

const DASHBOARD_PATHS = new Set(["/", "/feedback", "/export"]);

/** How long a page load waits for the default team before it goes on. */
export const DEFAULT_TEAM_TIMEOUT_MS = 2500;

/**
 * After a slow or failed lookup, navigations skip it for this long. The
 * page's own redirect for the period would otherwise wait a second time.
 */
export const DEFAULT_TEAM_SKIP_MS = 30_000;

let skipLookupUntil = 0;

export function resetDefaultTeamLookupForTesting(): void {
  skipLookupUntil = 0;
}

interface DashboardLocation {
  pathname: string;
  search: Record<string, unknown>;
  hash?: string;
}

class DefaultTeamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`No default team after ${timeoutMs} ms`);
    this.name = "DefaultTeamTimeoutError";
  }
}

/**
 * Writes the viewer's default team into the address before a dashboard page
 * fetches data. Without `team=` the API picks the viewer's own default team,
 * so a copied link could open another team for the recipient, and every data
 * query would run once without the team and again with it.
 *
 * The same redirect applies the period defaults, so the page's own
 * `beforeLoad` has nothing left to change. If the default team fails or is
 * slow, the page loads without it and FilterBar writes the team later.
 * Navigations in the next 30 seconds then skip the lookup.
 */
export async function redirectToDashboardTeam(
  location: DashboardLocation,
  { timeoutMs = DEFAULT_TEAM_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<void> {
  const pathname = location.pathname.replace(/(.)\/+$/, "$1");
  if (!DASHBOARD_PATHS.has(pathname)) return;

  const { team } = location.search;
  if (typeof team === "string" && team.length > 0) return;
  if (Date.now() < skipLookupUntil) return;

  let defaultTeam: string | undefined;
  try {
    defaultTeam = await fetchDefaultTeam(timeoutMs);
  } catch (error) {
    // On the server this memory is shared by all viewers. A 4xx answer is
    // about one viewer and comes back fast, so it does not count.
    if (!isViewerSpecificError(error)) {
      skipLookupUntil = Date.now() + DEFAULT_TEAM_SKIP_MS;
    }
    await logDefaultTeamFailure(pathname, error);
    return;
  }
  if (!defaultTeam) return;

  const { search } = applyDashboardSearchDefaults({
    ...location.search,
    team: defaultTeam,
  });
  throw redirect({
    to: pathname,
    search,
    ...(location.hash ? { hash: location.hash } : {}),
    replace: true,
  });
}

async function fetchDefaultTeam(
  timeoutMs: number,
): Promise<string | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DefaultTeamTimeoutError(timeoutMs)),
      timeoutMs,
    );
  });

  try {
    const bootstrap = await Promise.race([
      fetchFilterBootstrapServerFn({ data: {} }),
      timeout,
    ]);
    return bootstrap.selectedTeam;
  } finally {
    clearTimeout(timer);
  }
}

function isViewerSpecificError(error: unknown): boolean {
  return (
    error instanceof ApiErrorException &&
    error.error.status >= 400 &&
    error.error.status < 500
  );
}

/** Server-side only. In the browser, FilterBar shows the bootstrap error. */
async function logDefaultTeamFailure(
  pathname: string,
  error: unknown,
): Promise<void> {
  if (!import.meta.env.SSR) return;

  const { logger } = await import("~/server/logger");
  logger.warn(
    {
      pathname,
      reason: error instanceof DefaultTeamTimeoutError ? "timeout" : "error",
      errorName: error instanceof Error ? error.name : typeof error,
      status:
        error instanceof ApiErrorException ? error.error.status : undefined,
    },
    "Could not resolve the default team before rendering the dashboard",
  );
}
