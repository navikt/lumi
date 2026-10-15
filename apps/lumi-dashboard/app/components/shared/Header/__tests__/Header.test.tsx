import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "..";

vi.mock("~/components/shared/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

async function renderHeaderAt(url: string) {
  const rootRoute = createRootRoute({ component: Header });
  const childRoutes = [
    "/",
    "/feedback",
    "/export",
    "/surveyverksted",
    "/surveyverksted/$projectId",
  ].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: [url] }),
  });

  await router.load();
  render(createElement(RouterProvider, { router }));
}

function hrefOf(name: string) {
  const link = screen.getByRole("link", { name });
  const href = link.getAttribute("href") ?? "";
  const url = new URL(href, "http://localhost");
  return {
    pathname: url.pathname,
    search: Object.fromEntries(url.searchParams),
  };
}

describe("Header", () => {
  it("keeps only the team on the logo and Surveyverksted links", async () => {
    await renderHeaderAt(
      "/feedback?team=team-b&surveyId=survey-1&dateMode=fixed&fromDate=2026-01-01&toDate=2026-01-31",
    );

    expect(hrefOf("Lumi Dashboard - gå til forsiden")).toEqual({
      pathname: "/",
      search: { team: "team-b" },
    });
    expect(hrefOf("Surveyverksted")).toEqual({
      pathname: "/surveyverksted",
      search: { team: "team-b" },
    });
  });

  it("keeps the team and the other filters between dashboard pages", async () => {
    await renderHeaderAt("/feedback?team=team-b&surveyId=survey-1");

    for (const [name, pathname] of [
      ["Dashboard", "/"],
      ["Tilbakemeldinger", "/feedback"],
      ["Eksporter", "/export"],
    ] as const) {
      expect(hrefOf(name)).toEqual({
        pathname,
        search: { team: "team-b", surveyId: "survey-1" },
      });
    }
  });

  it("brings the Surveyverksted team back to the dashboard", async () => {
    await renderHeaderAt("/surveyverksted/project-1?team=team-b");

    expect(hrefOf("Lumi Dashboard - gå til forsiden").search).toEqual({
      team: "team-b",
    });
    expect(hrefOf("Dashboard").search).toEqual({ team: "team-b" });
    expect(hrefOf("Surveyverksted")).toEqual({
      pathname: "/surveyverksted",
      search: { team: "team-b" },
    });
  });

  it("adds no team when the URL has none", async () => {
    await renderHeaderAt("/feedback?surveyId=survey-1");

    expect(hrefOf("Lumi Dashboard - gå til forsiden")).toEqual({
      pathname: "/",
      search: {},
    });
    expect(hrefOf("Surveyverksted")).toEqual({
      pathname: "/surveyverksted",
      search: {},
    });
  });
});
