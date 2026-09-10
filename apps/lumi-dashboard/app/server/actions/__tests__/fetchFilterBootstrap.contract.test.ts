import { describe, expect, it } from "vitest";

import {
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
