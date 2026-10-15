import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ExportRoute } from "../export";
import { Route as DashboardRoute } from "../index";

const { access, mockBootstrap, mockStats } = vi.hoisted(() => ({
  access: { denied: false },
  mockBootstrap: { data: undefined as unknown, isPending: false },
  mockStats: {
    data: undefined as unknown,
    error: null as Error | null,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("~/hooks/useTeamAccessDenied", () => ({
  useTeamAccessDenied: () => access.denied,
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

// FilterBar shows the access alert and has its own suite. These stubs keep
// this test about what the pages show next to it.
vi.mock("~/components/shared/Header", () => ({ Header: () => null }));
vi.mock("~/components/shared/FilterBar", () => ({ FilterBar: () => null }));
vi.mock("~/components/shared/ActiveFiltersChips", () => ({
  ActiveFiltersChips: () => null,
}));
vi.mock("~/components/dashboard/views/Overview/Dashboard", () => ({
  OverviewDashboard: () => <p>Oversikt for teamet</p>,
}));
vi.mock("~/components/export/Panel", () => ({
  ExportPanel: () => <p>Eksportpanel</p>,
}));

async function renderPage(component: unknown, path: string) {
  const Page = component as ComponentType;
  const rootRoute = createRootRoute({ component: () => <Page /> });
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/analyseprodukter",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([otherRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  await router.load();
  return render(createElement(RouterProvider, { router }));
}

beforeEach(() => {
  access.denied = false;
  mockBootstrap.data = {
    selectedTeam: "team-esyfo",
    availableTeams: ["team-esyfo"],
    apps: ["dialogmote-frontend"],
    surveysByApp: {},
    tags: [],
    surveyMeta: {},
  };
  mockStats.data = { totalCount: 3 };
  mockStats.error = null;
  mockStats.isError = false;
});

describe("Dashboard when the team access is missing", () => {
  it("shows the dashboard when the team access is fine", async () => {
    await renderPage(DashboardRoute.options.component, "/");

    expect(await screen.findByText("Oversikt for teamet")).toBeInTheDocument();
  });

  it("shows neither the dashboard, the empty state nor its own error", async () => {
    access.denied = true;
    mockBootstrap.data = undefined;
    mockStats.error = new Error("Forbidden");
    mockStats.isError = true;

    await renderPage(DashboardRoute.options.component, "/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Oversikt for teamet")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingen svar ennå")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Kunne ikke hente dashboarddata"),
    ).not.toBeInTheDocument();
  });
});

describe("Eksporter when the team access is missing", () => {
  it("shows the export panel when the team access is fine", async () => {
    await renderPage(ExportRoute.options.component, "/export");

    expect(await screen.findByText("Eksportpanel")).toBeInTheDocument();
  });

  it("hides the export panel", async () => {
    access.denied = true;

    await renderPage(ExportRoute.options.component, "/export");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Eksporter data" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Eksportpanel")).not.toBeInTheDocument();
  });
});
