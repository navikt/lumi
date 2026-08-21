import { createMemoryHistory } from "@tanstack/history";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { act, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { useSearchParams } from "~/hooks/useSearchParams";
import { parseSearch, stringifySearch } from "~/router";
import { searchSchema } from "~/schemas/searchSchema";

type SearchParamsHook = ReturnType<typeof useSearchParams>;

async function setup(initialEntries: Array<string> = ["/"]) {
  const state: { current?: SearchParamsHook } = {};

  function TestComponent() {
    state.current = useSearchParams();
    return null;
  }

  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    validateSearch: zodValidator(searchSchema),
    component: TestComponent,
  });
  const routeTree = rootRoute.addChildren([indexRoute]);
  const history = createMemoryHistory({ initialEntries });
  const router = createRouter({
    routeTree,
    history,
    stringifySearch,
    parseSearch,
  });

  await router.load();
  render(createElement(RouterProvider, { router }));
  await waitFor(() => expect(state.current).toBeDefined());

  return {
    router,
    getResult: () => {
      if (!state.current) {
        throw new Error("Hook state is not available yet");
      }
      return state.current;
    },
  };
}

describe("useSearchParams", () => {
  it("returns empty params when URL has no search params", async () => {
    const { getResult } = await setup();

    expect(getResult().params).toEqual({});
  });

  it("parses existing search params from URL", async () => {
    const { getResult } = await setup(["/?team=flex&app=spinnsyn"]);

    expect(getResult().params.team).toBe("flex");
    expect(getResult().params.app).toBe("spinnsyn");
  });

  it("parses the dashboard date mode from the URL", async () => {
    expect(searchSchema.parse({ dateMode: "auto" })).toMatchObject({
      dateMode: "auto",
    });

    const { getResult } = await setup(["/?dateMode=auto"]);

    expect(getResult().params.dateMode).toBe("auto");
  });

  it("setParam adds a new parameter", async () => {
    const { router, getResult } = await setup();

    await act(async () => {
      getResult().setParam("team", "flex");
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe("?team=flex");
      expect(getResult().params.team).toBe("flex");
    });
  });

  it("setParam removes parameter when value is undefined", async () => {
    const { router, getResult } = await setup(["/?team=flex&app=spinnsyn"]);

    await act(async () => {
      getResult().setParam("team", undefined);
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe("?app=spinnsyn");
      expect(getResult().params.team).toBeUndefined();
    });
  });

  it("setParam removes parameter when value is empty string", async () => {
    const { router, getResult } = await setup(["/?team=flex"]);

    await act(async () => {
      getResult().setParam("team", "");
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe("");
    });
  });

  it("setParam merges sequential updates in the same handler", async () => {
    const { router, getResult } = await setup(["/?rating=field-1:5&team=flex"]);

    await act(async () => {
      getResult().setParam("rating", undefined);
      getResult().setParam("page", "1");
    });

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        page: "1",
        team: "flex",
      });
      expect(getResult().params.rating).toBeUndefined();
      expect(getResult().params.page).toBe("1");
      expect(getResult().params.team).toBe("flex");
    });
  });

  it("setParams sets multiple parameters at once", async () => {
    const { router, getResult } = await setup();

    await act(async () => {
      getResult().setParams({
        team: "flex",
        app: "spinnsyn",
        fromDate: "2024-01-01",
      });
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe(
        "?team=flex&app=spinnsyn&fromDate=2024-01-01",
      );
      expect(getResult().params.team).toBe("flex");
      expect(getResult().params.app).toBe("spinnsyn");
      expect(getResult().params.fromDate).toBe("2024-01-01");
    });
  });

  it("setParams removes existing parameters when passed undefined", async () => {
    const { router, getResult } = await setup(["/?team=flex&app=spinnsyn"]);

    await act(async () => {
      getResult().setParams({ team: undefined });
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe("?app=spinnsyn");
      expect(getResult().params.team).toBeUndefined();
    });
  });

  it("setParams removes task while preserving selected survey and period", async () => {
    const { router, getResult } = await setup([
      "/?surveyId=survey-top-tasks&task=TestTask&fromDate=2026-05-05&toDate=2026-06-03&page=1",
    ]);

    await act(async () => {
      getResult().setParams({ task: undefined, page: "1" });
    });

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        surveyId: "survey-top-tasks",
        fromDate: "2026-05-05",
        toDate: "2026-06-03",
        page: "1",
      });
      expect(router.state.location.searchStr).not.toContain("task=");
      expect(getResult().params.task).toBeUndefined();
    });
  });

  it("resetParams clears all parameters", async () => {
    const { router, getResult } = await setup([
      "/?team=flex&app=spinnsyn&fromDate=2024-01-01",
    ]);

    await act(async () => {
      getResult().resetParams();
    });

    await waitFor(() => {
      expect(router.state.location.searchStr).toBe("");
      expect(getResult().params).toEqual({});
    });
  });

  it("resetParams can replace all parameters with bounded defaults atomically", async () => {
    const { router, getResult } = await setup([
      "/?team=flex&app=spinnsyn&query=tekst",
    ]);

    await act(async () => {
      getResult().resetParams({
        team: "flex",
        dateMode: "auto",
        fromDate: "2026-05-05",
        toDate: "2026-06-03",
        page: "1",
      });
    });

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        team: "flex",
        dateMode: "auto",
        fromDate: "2026-05-05",
        toDate: "2026-06-03",
        page: "1",
      });
    });
  });

  it("handles special characters in parameter values", async () => {
    const { getResult } = await setup();

    await act(async () => {
      getResult().setParam("query", "søk med æøå");
    });

    await waitFor(() => {
      expect(getResult().params.query).toBe("søk med æøå");
    });
  });

  describe("legacy URL param migration", () => {
    it("migrates choiceFieldId/choiceValue to choice param", async () => {
      const { getResult } = await setup([
        "/?choiceFieldId=role&choiceValue=Arbeidsgiver",
      ]);

      await waitFor(() => {
        expect(getResult().params.choice).toBe("role:Arbeidsgiver");
      });
    });

    it("migrates ratingFieldId/ratingValue to rating param", async () => {
      const { getResult } = await setup([
        "/?ratingFieldId=tilfredshet&ratingValue=5",
      ]);

      await waitFor(() => {
        expect(getResult().params.rating).toBe("tilfredshet:5");
      });
    });

    it("preserves new choice param over legacy params", async () => {
      const { getResult } = await setup([
        "/?choice=role:Saksbehandler&choiceFieldId=role&choiceValue=Arbeidsgiver",
      ]);

      await waitFor(() => {
        expect(getResult().params.choice).toBe("role:Saksbehandler");
      });
    });

    it("does not migrate when only one legacy param is present", async () => {
      const { getResult } = await setup(["/?choiceFieldId=role"]);

      await waitFor(() => {
        expect(getResult().params.choice).toBeUndefined();
      });
    });
  });
});
