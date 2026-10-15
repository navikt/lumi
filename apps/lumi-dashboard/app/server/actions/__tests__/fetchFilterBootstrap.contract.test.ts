import { describe, expect, it } from "vitest";

import { ApiErrorException } from "~/types/errors";
import {
  assertMockTeamAccess,
  buildFilterBootstrapUrl,
  FILTER_BOOTSTRAP_PATH,
} from "../fetchFilterBootstrap";

describe("fetchFilterBootstrap contract", () => {
  it("forwards the team scope to the bootstrap endpoint", () => {
    const url = buildFilterBootstrapUrl("https://backend.example", {
      team: "team-test",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe(FILTER_BOOTSTRAP_PATH);
    expect(parsed.searchParams.get("team")).toBe("team-test");
  });
});

describe("mock team access", () => {
  it("refuses a team the mock viewer is not a member of, like the API", () => {
    let thrown: unknown;
    try {
      assertMockTeamAccess("team-x");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiErrorException);
    expect((thrown as ApiErrorException).error).toMatchObject({
      status: 403,
      type: "AUTHORIZATION_ERROR",
      message: "Du har ikke tilgang til team: team-x",
    });
  });

  it("does not treat object prototype keys as teams", () => {
    expect(() => assertMockTeamAccess("toString")).toThrow(ApiErrorException);
    expect(() => assertMockTeamAccess("constructor")).toThrow(
      ApiErrorException,
    );
  });

  it("allows the mock team and a missing team", () => {
    expect(() => assertMockTeamAccess("team-esyfo")).not.toThrow();
    expect(() => assertMockTeamAccess(undefined)).not.toThrow();
  });
});
