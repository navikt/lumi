import { describe, expect, it } from "vitest";

import {
  buildFilterBootstrapUrl,
  buildRefreshFilterBootstrapUrl,
  FILTER_BOOTSTRAP_PATH,
} from "../fetchFilterBootstrap";

describe("fetchFilterBootstrap contract", () => {
  it("forwards the explicit refresh signal to the bootstrap endpoint", () => {
    const url = buildRefreshFilterBootstrapUrl("https://backend.example", {
      team: "team-test",
    });

    const parsed = new URL(url);
    expect(parsed.pathname).toBe(FILTER_BOOTSTRAP_PATH);
    expect(parsed.searchParams.get("team")).toBe("team-test");
    expect(parsed.searchParams.get("refresh")).toBe("true");
  });

  it("does not add a refresh signal to ordinary bootstrap requests", () => {
    const url = buildFilterBootstrapUrl("https://backend.example", {
      team: "team-test",
    });

    expect(new URL(url).searchParams.has("refresh")).toBe(false);
  });
});
