import { createMemoryHistory } from "@tanstack/history";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
  Outlet,
  RouterProvider,
  redirect,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStats } from "~/hooks/useStats";
import {
  fetchFilterBootstrapServerFn,
  fetchStatsServerFn,
} from "~/server/actions";
import { logger } from "~/server/logger";
import { HttpStatusError } from "~/server/serverFnStatus";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { applyDashboardSearchDefaults } from "~/utils/dashboardSearchDefaults";
import {
  DEFAULT_TEAM_SKIP_MS,
  DEFAULT_TEAM_TIMEOUT_MS,
  redirectToDashboardTeam,
  resetDefaultTeamLookupForTesting,
} from "~/utils/dashboardTeam";

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
  fetchStatsServerFn: vi.fn(),
}));

vi.mock("~/server/logger", () => ({
  logger: { warn: vi.fn() },
}));

const mockFetchBootstrap = vi.mocked(fetchFilterBootstrapServerFn);
const mockFetchStats = vi.mocked(fetchStatsServerFn);
const mockLogger = vi.mocked(logger);

function StatsPage() {
  const { data } = useStats();
  return createElement("p", null, data ? "Statistikk lastet" : "Laster");
}

async function renderAt(url: string) {
  const rootRoute = createRootRoute({
    beforeLoad: ({ location }) => redirectToDashboardTeam(location),
    component: () => createElement(Outlet),
  });
  const routes = ["/feedback", "/other"].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: StatsPage,
    }),
  );
  // Like the real dashboard pages, Eksporter redirects to the default period.
  const exportRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/export",
    beforeLoad: ({ location }) => {
      const defaults = applyDashboardSearchDefaults(location.search);
      if (defaults.changed) {
        throw redirect({
          to: "/export",
          search: defaults.search,
          replace: true,
        });
      }
    },
    component: StatsPage,
  });
  const history = createMemoryHistory({ initialEntries: ["/start", url] });
  const router = createRouter({
    routeTree: rootRoute.addChildren([...routes, exportRoute]),
    history,
  });
  await router.load();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(RouterProvider, { router }),
    ),
  );
  return { router, history };
}

describe("redirectToDashboardTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultTeamLookupForTesting();
    mockFetchBootstrap.mockResolvedValue({
      selectedTeam: "team-a",
      availableTeams: ["team-a", "team-b"],
    } as never);
    mockFetchStats.mockResolvedValue({ fieldStats: [] } as never);
  });

  it("writes the default team before the page fetches stats", async () => {
    const { router, history } = await renderAt(
      "/feedback?surveyId=s1&dateMode=fixed&fromDate=2026-01-01&toDate=2026-01-31",
    );

    expect(await screen.findByText("Statistikk lastet")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({
      team: "team-a",
      surveyId: "s1",
      dateMode: "fixed",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    });
    expect(mockFetchStats).toHaveBeenCalledOnce();
    expect(mockFetchStats).toHaveBeenCalledWith({
      data: expect.objectContaining({ team: "team-a", surveyId: "s1" }),
    });
    // The redirect replaces the entry, so Back leaves the dashboard.
    expect(history.length).toBe(2);
  });

  it("keeps a team that is already in the address", async () => {
    const { router } = await renderAt("/feedback?team=team-b");

    expect(await screen.findByText("Statistikk lastet")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ team: "team-b" });
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
    expect(mockFetchStats).toHaveBeenCalledWith({
      data: expect.objectContaining({ team: "team-b" }),
    });
  });

  it("loads the page without a team when the default team cannot be fetched", async () => {
    mockFetchBootstrap.mockRejectedValue(new Error("Midlertidig feil"));

    const { router } = await renderAt("/feedback?surveyId=s1");

    expect(await screen.findByText("Statistikk lastet")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/feedback");
    expect(router.state.location.search).toEqual({ surveyId: "s1" });
  });

  it("does not look up the team again for the page's own period redirect", async () => {
    mockFetchBootstrap.mockRejectedValue(new Error("Midlertidig feil"));

    const { router } = await renderAt("/export");

    expect(await screen.findByText("Statistikk lastet")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ dateMode: "auto" });
    expect(mockFetchBootstrap).toHaveBeenCalledOnce();
  });

  it("leaves pages outside the dashboard alone", async () => {
    const { router } = await renderAt("/other?surveyId=s1");

    await waitFor(() => expect(router.state.location.pathname).toBe("/other"));
    expect(router.state.location.search).toEqual({ surveyId: "s1" });
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });
});

/** The redirect options, or undefined when the page loads as it is. */
async function redirectFor(
  location: Parameters<typeof redirectToDashboardTeam>[0],
) {
  try {
    await redirectToDashboardTeam(location);
  } catch (error) {
    if (isRedirect(error)) return error.options;
    throw error;
  }
  return undefined;
}

describe("redirectToDashboardTeam paths and failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultTeamLookupForTesting();
    mockFetchBootstrap.mockResolvedValue({
      selectedTeam: "team-a",
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("applies the period defaults in the same redirect on the dashboard", async () => {
    const options = await redirectFor({ pathname: "/", search: {} });
    const defaults = applyDashboardSearchDefaults({ team: "team-a" });

    expect(options).toMatchObject({
      to: "/",
      replace: true,
      search: defaults.search,
    });
    expect(options?.search).toMatchObject({
      team: "team-a",
      dateMode: "auto",
      page: "1",
    });
    // The route's own beforeLoad then has nothing left to change.
    expect(applyDashboardSearchDefaults(defaults.search).changed).toBe(false);
  });

  it("redirects on Eksporter and keeps the filters", async () => {
    const options = await redirectFor({
      pathname: "/export",
      search: { surveyId: "s1", dateMode: "fixed", fromDate: "2026-01-01" },
    });

    expect(options).toMatchObject({
      to: "/export",
      search: { team: "team-a", surveyId: "s1", fromDate: "2026-01-01" },
    });
  });

  it("treats an empty team as missing", async () => {
    const options = await redirectFor({
      pathname: "/feedback",
      search: { team: "" },
    });

    expect(options?.search).toMatchObject({ team: "team-a" });
  });

  it("handles a trailing slash", async () => {
    const options = await redirectFor({ pathname: "/feedback/", search: {} });

    expect(options).toMatchObject({ to: "/feedback" });
  });

  it("keeps the hash in the browser", async () => {
    const options = await redirectFor({
      pathname: "/feedback",
      search: {},
      hash: "svar",
    });

    expect(options).toMatchObject({ hash: "svar" });
  });

  it("does not redirect pages that only start like a dashboard page", async () => {
    await expect(
      redirectFor({ pathname: "/feedback-old", search: {} }),
    ).resolves.toBeUndefined();
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });

  it("gives up after the timeout and logs it on the server", async () => {
    vi.stubEnv("SSR", true);
    vi.useFakeTimers();
    mockFetchBootstrap.mockReturnValue(new Promise(() => undefined) as never);

    const result = redirectFor({ pathname: "/", search: {} });
    await vi.advanceTimersByTimeAsync(DEFAULT_TEAM_TIMEOUT_MS - 1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledExactlyOnceWith(
      { pathname: "/", reason: "timeout", timeoutMs: DEFAULT_TEAM_TIMEOUT_MS },
      "Could not resolve the default team before rendering the dashboard",
    );
  });

  // serverFnFailureMiddleware in start.ts logs the failed server function.
  it("leaves a failed request to the log line for server functions", async () => {
    vi.stubEnv("SSR", true);
    mockFetchBootstrap.mockRejectedValue(
      new ApiErrorException({
        status: 503,
        type: ErrorType.INTERNAL_SERVER_ERROR,
        message: "Kunne ikke hente teamtilgang akkurat nå",
        timestamp: "2026-10-15T08:00:00Z",
      }),
    );

    await expect(
      redirectFor({ pathname: "/feedback", search: {} }),
    ).resolves.toBeUndefined();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not wait again on the next navigation after a timeout", async () => {
    vi.useFakeTimers();
    mockFetchBootstrap.mockReturnValue(new Promise(() => undefined) as never);

    const first = redirectFor({ pathname: "/", search: {} });
    await vi.advanceTimersByTimeAsync(DEFAULT_TEAM_TIMEOUT_MS);
    await expect(first).resolves.toBeUndefined();

    // Resolves without any timer: the lookup is skipped.
    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toBeUndefined();
    expect(mockFetchBootstrap).toHaveBeenCalledOnce();

    mockFetchBootstrap.mockResolvedValue({ selectedTeam: "team-a" } as never);
    await vi.advanceTimersByTimeAsync(DEFAULT_TEAM_SKIP_MS);
    await expect(
      redirectFor({ pathname: "/feedback", search: {} }),
    ).resolves.toMatchObject({ search: { team: "team-a" } });
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it("keeps looking up the team after a 4xx answer about one viewer", async () => {
    mockFetchBootstrap.mockRejectedValueOnce(
      new ApiErrorException({
        status: 403,
        type: ErrorType.AUTHORIZATION_ERROR,
        message: "Du må være medlem av et team i Nais Console for å bruke Lumi",
        timestamp: "2026-10-15T08:00:00Z",
      }),
    );

    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toBeUndefined();
    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toMatchObject({ search: { team: "team-a" } });
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it("keeps looking up the team after authMiddleware refuses one viewer", async () => {
    mockFetchBootstrap.mockRejectedValueOnce(
      new HttpStatusError(401, "Unauthorized: No token provided"),
    );

    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toBeUndefined();
    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toMatchObject({ search: { team: "team-a" } });
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it("pauses the lookup for everyone when the token exchange fails", async () => {
    mockFetchBootstrap.mockRejectedValueOnce(
      new HttpStatusError(502, "Token exchange failed"),
    );

    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toBeUndefined();
    await expect(
      redirectFor({ pathname: "/", search: {} }),
    ).resolves.toBeUndefined();
    expect(mockFetchBootstrap).toHaveBeenCalledOnce();
  });

  it("does not log a timeout in the browser", async () => {
    vi.useFakeTimers();
    mockFetchBootstrap.mockReturnValue(new Promise(() => undefined) as never);

    const result = redirectFor({ pathname: "/feedback", search: {} });
    await vi.advanceTimersByTimeAsync(DEFAULT_TEAM_TIMEOUT_MS);

    await expect(result).resolves.toBeUndefined();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
