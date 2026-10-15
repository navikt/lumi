import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { GET_STARTED_URL, GetStartedEmptyState } from "..";

async function renderWithRouter(ui: React.ReactElement) {
  const rootRoute = createRootRoute({ component: () => ui });
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

describe("GetStartedEmptyState", () => {
  it("shows the selected team and keeps it on the Surveyverksted link", async () => {
    await renderWithRouter(
      <GetStartedEmptyState
        heading="Ingen svar ennå"
        description="Grafene vises her."
        team="team-ny"
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "Ingen svar ennå" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Valgt team:")).toHaveTextContent(
      "Valgt team: team-ny",
    );
    expect(screen.getByText("Grafene vises her.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Kom i gang med Lumi" }),
    ).toHaveAttribute("href", GET_STARTED_URL);
    expect(
      screen.getByRole("link", { name: "Lag en survey i Surveyverksted" }),
    ).toHaveAttribute("href", "/surveyverksted?team=team-ny");
  });

  it("leaves out the team when it is unknown", async () => {
    await renderWithRouter(
      <GetStartedEmptyState
        heading="Ingen tilbakemeldinger ennå"
        description="Svarene dukker opp her."
      />,
    );

    expect(
      await screen.findByRole("link", {
        name: "Lag en survey i Surveyverksted",
      }),
    ).toHaveAttribute("href", "/surveyverksted");
    expect(screen.queryByText(/Valgt team/)).not.toBeInTheDocument();
  });
});
