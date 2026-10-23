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
    // A server function that fails is logged by serverFnFailureMiddleware in
    // start.ts. Only the timeout belongs to this function.
    if (error instanceof DefaultTeamTimeoutError) {
      await logDefaultTeamTimeout(pathname, timeoutMs);
    }
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

/**
 * A 4xx answer: Lumi API's own, or authMiddleware's when the login is
 * missing. A failed token exchange gives 502 and counts for everyone.
 */
function isViewerSpecificError(error: unknown): boolean {
  const status = errorStatus(error);
  return status !== undefined && status >= 400 && status < 500;
}

/**
 * Lumi API's status, or the numeric status an error from the server carries
 * itself. In the browser an error from a server function has only its
 * message, unless it is an ApiErrorException.
 */
function errorStatus(error: unknown): number | undefined {
  if (error instanceof ApiErrorException) return error.error.status;
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return typeof error.status === "number" ? error.status : undefined;
}

/** Server-side only. In the browser, FilterBar shows the bootstrap error. */
async function logDefaultTeamTimeout(
  pathname: string,
  timeoutMs: number,
): Promise<void> {
  if (!import.meta.env.SSR) return;

  const { logger } = await import("~/server/logger");
  logger.warn(
    { pathname, reason: "timeout", timeoutMs },
    "Could not resolve the default team before rendering the dashboard",
  );
}
