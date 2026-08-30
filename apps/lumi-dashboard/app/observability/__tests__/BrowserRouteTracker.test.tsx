import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pushEvent: vi.fn(),
}));

vi.mock("@nais/apm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nais/apm")>()),
  isInitialized: () => true,
  pushEvent: mocks.pushEvent,
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/surveyverksted/project-123" } }),
}));

vi.mock("~/observability/browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/observability/browser")>()),
  isBrowserObservabilityEnabled: () => true,
}));

import { BrowserRouteTracker } from "~/observability/BrowserRouteTracker";

describe("BrowserRouteTracker", () => {
  it("reports only the normalized TanStack route", () => {
    render(<BrowserRouteTracker />);

    expect(mocks.pushEvent).toHaveBeenCalledWith("route_change", {
      toRoute: "/surveyverksted/{projectId}",
      toUrl: "/surveyverksted/{projectId}",
    });
  });
});
