import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as DashboardRoute } from "../index";

const { mockBootstrap, mockStats } = vi.hoisted(() => ({
  mockBootstrap: { data: undefined as unknown, isPending: true },
  mockStats: {
    data: undefined as unknown,
    error: null as Error | null,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("~/hooks/useFilterBootstrap", () => ({
  useFilterBootstrap: () => mockBootstrap,
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => mockStats,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: {}, setParams: vi.fn() }),
}));

// The page chrome and dashboards have their own suites. These stubs keep this
// test about which content the front page chooses.
vi.mock("~/components/shared/Header", () => ({ Header: () => null }));
vi.mock("~/components/shared/FilterBar", () => ({ FilterBar: () => null }));
vi.mock("~/components/shared/ActiveFiltersChips", () => ({
  ActiveFiltersChips: () => null,
}));
vi.mock("~/components/dashboard/views/Overview/Dashboard", () => ({
  OverviewDashboard: () => <p>Oversikt for teamet</p>,
}));

function bootstrap(apps: string[]) {
  return {
    selectedTeam: "team-ny",
    availableTeams: ["team-esyfo", "team-ny"],
    apps,
    surveysByApp: {},
    tags: [],
    surveyMeta: {},
  };
}

async function renderDashboard() {
  const DashboardPage = DashboardRoute.options.component as ComponentType;
  const rootRoute = createRootRoute({ component: () => <DashboardPage /> });
  const surveyverkstedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/surveyverksted",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([surveyverkstedRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return render(createElement(RouterProvider, { router }));
}

describe("Dashboard front page for a team without answers", () => {
  beforeEach(() => {
    mockBootstrap.data = undefined;
    mockBootstrap.isPending = true;
    mockStats.data = undefined;
    mockStats.error = null;
    mockStats.isPending = false;
    mockStats.isError = false;
  });

  it("shows the selected team with links to get started and Surveyverksted", async () => {
    mockBootstrap.data = bootstrap([]);
    mockBootstrap.isPending = false;

    await renderDashboard();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Ingen svar ennå" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Valgt team:")).toHaveTextContent(
      "Valgt team: team-ny",
    );
    expect(
      screen.getByRole("link", { name: "Kom i gang med Lumi" }),
    ).toHaveAttribute(
      "href",
      "https://navikt.github.io/lumi/kom-i-gang/hva-er-lumi",
    );
    expect(
      screen.getByRole("link", { name: "Lag en survey i Surveyverksted" }),
    ).toHaveAttribute("href", "/surveyverksted?team=team-ny");
    expect(screen.queryByText("Oversikt for teamet")).not.toBeInTheDocument();
  });

  it("shows the empty state instead of a stats error when the team has no answers", async () => {
    mockBootstrap.data = bootstrap([]);
    mockBootstrap.isPending = false;
    mockStats.error = new Error("API unavailable");
    mockStats.isError = true;

    await renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Ingen svar ennå" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Kunne ikke hente dashboarddata"),
    ).not.toBeInTheDocument();
  });

  it("shows the dashboard when the team has apps with answers", async () => {
    mockBootstrap.data = bootstrap(["dialogmote-frontend"]);
    mockBootstrap.isPending = false;

    await renderDashboard();

    expect(await screen.findByText("Oversikt for teamet")).toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
  });

  it("shows the dashboard when stats has answers but the cached apps list is still empty", async () => {
    mockBootstrap.data = bootstrap([]);
    mockBootstrap.isPending = false;
    mockStats.data = { totalCount: 1 };

    await renderDashboard();

    expect(await screen.findByText("Oversikt for teamet")).toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
  });

  it("shows the privacy notice instead of the empty state when stats is masked", async () => {
    mockBootstrap.data = bootstrap([]);
    mockBootstrap.isPending = false;
    mockStats.data = {
      totalCount: 0,
      privacy: { masked: true, threshold: 5 },
    };

    await renderDashboard();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
    expect(screen.queryByText("Oversikt for teamet")).not.toBeInTheDocument();
  });

  it("shows the dashboard while stats and the team's apps are loading", async () => {
    mockStats.isPending = true;

    await renderDashboard();

    expect(await screen.findByText("Oversikt for teamet")).toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
  });

  it("waits for the team's apps before showing cards for empty stats", async () => {
    mockStats.data = { totalCount: 0 };

    await renderDashboard();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oversikt for teamet")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
  });
});
