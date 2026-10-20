import { createMemoryHistory } from "@tanstack/history";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentType, createElement, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataFetchBoundary } from "~/components/shared/DataFetchBoundary";
import { useTeamAccessDenied } from "~/hooks/useTeamAccessDenied";
import { fetchFilterBootstrapServerFn } from "~/server/actions";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { redirectToDashboardTeam } from "~/utils/dashboardTeam";
import { FilterBar } from "..";

const AVAILABLE_TEAMS = ["team-a", "team-b"];

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({
    data: { fieldStats: [] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: () => ({ themes: [] }),
}));

vi.mock("~/components/dashboard/PeriodSelector", () => ({
  PeriodSelector: () => null,
}));

const mockFetchBootstrap = vi.mocked(fetchFilterBootstrapServerFn);

function bootstrapFor({ data }: { data: { team?: string } }) {
  if (data.team && !AVAILABLE_TEAMS.includes(data.team)) {
    return Promise.reject(
      new ApiErrorException({
        status: 403,
        type: ErrorType.AUTHORIZATION_ERROR,
        message: `Du har ikke tilgang til team: ${data.team}`,
        timestamp: "2026-10-14T10:00:00Z",
      }),
    );
  }

  return Promise.resolve({
    generatedAt: "2026-10-14T10:00:00Z",
    selectedTeam: data.team ?? "team-a",
    availableTeams: AVAILABLE_TEAMS,
    deviceTypes: [],
    apps: ["app"],
    surveysByApp: { app: ["s1", "s2"] },
    tags: [],
    surveyMeta: {
      s1: {
        archivedAt: null,
        firstSubmissionAt: "2024-01-01T12:00:00Z",
        lastSubmissionAt: "2024-02-18T12:00:00Z",
      },
      s2: { archivedAt: "2026-01-01T00:00:00Z" },
    },
  });
}

async function renderFilterBarAt(
  url: string,
  {
    withTeamRedirect = false,
    strict = false,
    page,
  }: {
    withTeamRedirect?: boolean;
    strict?: boolean;
    page?: ComponentType;
  } = {},
) {
  const rootRoute = createRootRoute({
    beforeLoad: withTeamRedirect
      ? ({ location }) => redirectToDashboardTeam(location)
      : undefined,
    component: () => createElement(Outlet),
  });
  const feedbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/feedback",
    component: () =>
      createElement(
        "div",
        null,
        createElement(FilterBar),
        page ? createElement(page) : null,
      ),
  });
  const history = createMemoryHistory({ initialEntries: ["/start", url] });
  const router = createRouter({
    routeTree: rootRoute.addChildren([feedbackRoute]),
    history,
  });
  await router.load();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const tree = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(RouterProvider, { router }),
  );
  render(strict ? createElement(StrictMode, null, tree) : tree);
  return { router, history };
}

describe("FilterBar team in the address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBootstrap.mockImplementation(bootstrapFor as never);
  });

  for (const strict of [false, true]) {
    it(`writes the default team with replace and keeps other filters (strict mode: ${strict})`, async () => {
      const { router, history } = await renderFilterBarAt(
        "/feedback?surveyId=s1&app=app&dateMode=fixed&fromDate=2026-01-01&toDate=2026-01-31",
        { strict },
      );

      await waitFor(() =>
        expect(router.state.location.search).toMatchObject({
          team: "team-a",
        }),
      );
      expect(router.state.location.search).toMatchObject({
        surveyId: "s1",
        app: "app",
        dateMode: "fixed",
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
      });
      expect(history.length).toBe(2);
    });
  }

  it("keeps a team that is already in the address", async () => {
    const { router } = await renderFilterBarAt(
      "/feedback?team=team-b&surveyId=s1&dateMode=fixed&fromDate=2026-01-01&toDate=2026-01-31",
    );

    await screen.findAllByRole("combobox", { name: "Team" });
    expect(router.state.location.search).toMatchObject({ team: "team-b" });
  });

  it("writes the team together with the survey period", async () => {
    const { router } = await renderFilterBarAt(
      "/feedback?surveyId=s1&dateMode=auto&fromDate=2020-01-01&toDate=2020-01-30",
    );

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        team: "team-a",
        dateMode: "auto",
        toDate: "2024-02-18",
      }),
    );
  });

  it("writes the team together with the archived survey cleanup", async () => {
    const { router } = await renderFilterBarAt(
      "/feedback?surveyId=s2&app=app&dateMode=fixed&fromDate=2026-01-01&toDate=2026-01-31",
    );

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ team: "team-a" }),
    );
    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty("surveyId"),
    );
  });

  it("explains a team without access and links to the default team", async () => {
    const user = userEvent.setup();
    const { router } = await renderFilterBarAt(
      "/feedback?team=team-x&surveyId=s1",
      { withTeamRedirect: true },
    );

    expect(
      await screen.findByText("Du har ikke tilgang til team «team-x»."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Du må være medlem av teamet i Nais Console for å se dataene.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Les mer om tilgang" }),
    ).toHaveAttribute(
      "href",
      "https://navikt.github.io/lumi/dashboard/tilgang#teamtilgang",
    );
    expect(screen.queryByText("Prøv igjen")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("link", { name: "Gå til standardteamet" }),
    );

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ team: "team-a" }),
    );
    expect(router.state.location.search).not.toHaveProperty("surveyId");
    expect(router.state.location.pathname).toBe("/feedback");
    expect(
      await screen.findAllByRole("combobox", { name: "Team" }),
    ).not.toHaveLength(0);
    // A refused team is not retried.
    expect(
      mockFetchBootstrap.mock.calls.filter(
        ([options]) =>
          (options as { data: { team?: string } }).data.team === "team-x",
      ),
    ).toHaveLength(1);
  });
});

function apiError(
  status: number,
  message: string,
  extra: { details?: string; helpUrl?: string } = {},
) {
  return new ApiErrorException({
    status,
    type:
      status === 401
        ? ErrorType.AUTHENTICATION_ERROR
        : status === 403
          ? ErrorType.AUTHORIZATION_ERROR
          : ErrorType.INTERNAL_SERVER_ERROR,
    message,
    timestamp: "2026-10-15T08:00:00Z",
    ...extra,
  });
}

// Texts exactly as the API sends them (TeamAuthorizationPlugin.kt).
const NO_TEAMS = {
  message: "Du må være medlem av et team i Nais Console for å bruke Lumi",
  details:
    "Lumi fant ingen team for deg i Nais. Be teamet ditt legge deg til som medlem i Nais Console, vent opptil fem minutter og last siden på nytt.",
  helpUrl: "https://navikt.github.io/lumi/dashboard/tilgang#teamtilgang",
};
const LOOKUP_DOWN = {
  message: "Kunne ikke hente teamtilgang akkurat nå",
  details:
    "Dette er ofte midlertidig, for eksempel når Nais API er nede. Jobber du utenfor Nav-nettet, sjekk at Kolide kjører. Prøv igjen om litt.",
};

describe("FilterBar access errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the API's message, details and help link when the viewer has no team", async () => {
    mockFetchBootstrap.mockRejectedValue(
      apiError(403, NO_TEAMS.message, {
        details: NO_TEAMS.details,
        helpUrl: NO_TEAMS.helpUrl,
      }),
    );

    await renderFilterBarAt("/feedback");

    expect(await screen.findByText(NO_TEAMS.message)).toBeInTheDocument();
    expect(
      screen.getByText(NO_TEAMS.details, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Les mer om tilgang" }),
    ).toHaveAttribute("href", NO_TEAMS.helpUrl);
    expect(
      screen.queryByRole("link", { name: "Gå til standardteamet" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Prøv igjen")).not.toBeInTheDocument();
    expect(mockFetchBootstrap).toHaveBeenCalledOnce();
  });

  // "Nais", "Lumi" and "team" are words in the message about having no team.
  for (const team of ["team-b", "Nais", "Lumi", "team"]) {
    it(`offers no default team for team=${team} when the viewer has no team`, async () => {
      mockFetchBootstrap.mockRejectedValue(
        apiError(403, NO_TEAMS.message, {
          details: NO_TEAMS.details,
          helpUrl: NO_TEAMS.helpUrl,
        }),
      );

      await renderFilterBarAt(`/feedback?team=${team}`);

      expect(await screen.findByText(NO_TEAMS.message)).toBeInTheDocument();
      expect(
        screen.queryByText(`Du har ikke tilgang til team «${team}».`),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Gå til standardteamet" }),
      ).not.toBeInTheDocument();
    });
  }

  it("does not link to a help page that is not https", async () => {
    mockFetchBootstrap.mockRejectedValue(
      apiError(403, NO_TEAMS.message, { helpUrl: "javascript:alert(1)" }),
    );

    await renderFilterBarAt("/feedback");

    expect(await screen.findByText(NO_TEAMS.message)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("asks the viewer to reload after a 401", async () => {
    mockFetchBootstrap.mockRejectedValue(apiError(401, "Not authenticated"));

    await renderFilterBarAt("/feedback?team=team-a");

    expect(
      await screen.findByText("Du er ikke logget inn"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Innloggingen har gått ut. Last siden på nytt."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not authenticated")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Gå til standardteamet" }),
    ).not.toBeInTheDocument();
    expect(mockFetchBootstrap).toHaveBeenCalledOnce();
  });

  it("shows the API's message for a 503 and lets the viewer retry", async () => {
    const user = userEvent.setup();
    mockFetchBootstrap.mockRejectedValue(
      apiError(503, LOOKUP_DOWN.message, { details: LOOKUP_DOWN.details }),
    );

    await renderFilterBarAt("/feedback?team=team-a");

    expect(
      await screen.findByText(LOOKUP_DOWN.message, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(LOOKUP_DOWN.details)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Gå til standardteamet" }),
    ).not.toBeInTheDocument();
    // Unlike a 4xx answer, the request is retried once before the alert.
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);

    mockFetchBootstrap.mockImplementation(bootstrapFor as never);
    await user.click(screen.getByRole("button", { name: "Prøv igjen" }));

    expect(
      await screen.findAllByRole("combobox", { name: "Team" }),
    ).not.toHaveLength(0);
  });

  it("does not retry when the database is unavailable", async () => {
    mockFetchBootstrap.mockRejectedValue(
      new ApiErrorException({
        status: 503,
        type: ErrorType.DATABASE_UNAVAILABLE,
        message: "Databasen svarer ikke akkurat nå",
        details: "Dette er som regel midlertidig. Prøv igjen om litt.",
        timestamp: "2026-10-20T08:00:00Z",
      }),
    );

    await renderFilterBarAt("/feedback?team=team-a");

    expect(
      await screen.findByText("Databasen svarer ikke akkurat nå"),
    ).toBeInTheDocument();
    // A new attempt would run the same heavy query against a busy database.
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Prøv igjen" }),
    ).toBeInTheDocument();
  });

  it("retries the page's own failed queries in the same click after a 503", async () => {
    const user = userEvent.setup();
    const fetchPageData = vi.fn();
    // Like the pages: its own query, hidden while FilterBar explains the error.
    function Page() {
      const teamAccessDenied = useTeamAccessDenied();
      const pageQuery = useQuery({
        queryKey: ["feedback", "page"],
        queryFn: () => fetchPageData(),
      });
      if (teamAccessDenied) return null;
      return createElement(
        DataFetchBoundary,
        { title: "Kunne ikke hente tilbakemeldinger", queries: [pageQuery] },
        createElement("p", null, "Sidens data"),
      );
    }
    const lookupDown = apiError(503, LOOKUP_DOWN.message, {
      details: LOOKUP_DOWN.details,
    });
    mockFetchBootstrap.mockRejectedValue(lookupDown);
    fetchPageData.mockRejectedValue(lookupDown);

    await renderFilterBarAt("/feedback?team=team-a", { page: Page });

    expect(
      await screen.findByText(LOOKUP_DOWN.message, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchPageData).toHaveBeenCalled());

    mockFetchBootstrap.mockImplementation(bootstrapFor as never);
    fetchPageData.mockResolvedValue({ items: [] });
    await user.click(screen.getByRole("button", { name: "Prøv igjen" }));

    expect(await screen.findByText("Sidens data")).toBeInTheDocument();
    expect(screen.queryByText(LOOKUP_DOWN.message)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Kunne ikke hente tilbakemeldinger"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the generic alert for errors that are not about access", async () => {
    const badRequest = "Invalid payload: deduplicationKey requires surveyId";
    mockFetchBootstrap.mockRejectedValue(apiError(400, badRequest));

    await renderFilterBarAt("/feedback?team=team-a");

    expect(
      await screen.findByText("Kunne ikke hente filtre"),
    ).toBeInTheDocument();
    expect(screen.queryByText(badRequest)).not.toBeInTheDocument();
  });
});
