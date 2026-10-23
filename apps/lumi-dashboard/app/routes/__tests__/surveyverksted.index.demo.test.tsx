import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSurveyAuthoringAccessServerFn,
  fetchSurveyAuthoringProjectsServerFn,
  fetchTeamsServerFn,
} from "~/server/actions";
import { Route as SurveyWorkshopIndexRoute } from "../surveyverksted.index";

vi.mock("~/server/actions", () => ({
  createSurveyAuthoringProjectServerFn: vi.fn(),
  deleteSurveyAuthoringProjectServerFn: vi.fn(),
  fetchSurveyAuthoringAccessServerFn: vi.fn(),
  fetchSurveyAuthoringProjectsServerFn: vi.fn(),
  fetchTeamsServerFn: vi.fn(),
}));

async function renderIndex(canSave: boolean) {
  vi.mocked(fetchTeamsServerFn).mockResolvedValue({
    teams: { "team-esyfo": ["app-a"] },
  });
  vi.mocked(fetchSurveyAuthoringAccessServerFn).mockResolvedValue({ canSave });
  vi.mocked(fetchSurveyAuthoringProjectsServerFn).mockResolvedValue([]);

  const rootRoute = createRootRoute();
  const workshopRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/surveyverksted",
  });
  const indexRoute = SurveyWorkshopIndexRoute.update({
    id: "/",
    path: "/",
    getParentRoute: () => workshopRoute,
  } as never);
  const router = createRouter({
    routeTree: rootRoute.addChildren([workshopRoute.addChildren([indexRoute])]),
    history: createMemoryHistory({ initialEntries: ["/surveyverksted"] }),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await router.load();
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("Ingen surveys ennå");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Surveyverksted index in the public demo", () => {
  it("explains the demo inside the form instead of offering a create button", async () => {
    await renderIndex(false);

    expect(
      screen.getAllByRole("link", { name: "Logg inn i Lumi-dashboardet" }),
    ).toHaveLength(1);
    expect(screen.getByText(/Demoen lagrer ikke utkast/)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Hva vil dere finne ut/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Navn på utkastet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Opprett utkast" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Demoen har ingen utkast. Teamets surveyer vises her i Lumi-dashboardet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Utkastet lagres for teamet/),
    ).not.toBeInTheDocument();
  });

  it("keeps the full form where drafts can be saved", async () => {
    await renderIndex(true);

    expect(
      screen.getByRole("textbox", { name: "Navn på utkastet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Opprett utkast" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Utkastet lagres for teamet/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Demoen lagrer ikke utkast/),
    ).not.toBeInTheDocument();
  });
});
