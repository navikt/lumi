import { describe, expect, it } from "vitest";

import { resolveLocalAuthPolicy } from "../localAuthPolicy";

describe("resolveLocalAuthPolicy", () => {
  it("allows mock mode without a backend token", () => {
    expect(
      resolveLocalAuthPolicy({
        isMockMode: true,
        localAuthBypass: "false",
      }),
    ).toEqual({ bypassEnabled: true, oboToken: null });
  });

  it("requires explicit opt-in for local real-data mode", () => {
    expect(
      resolveLocalAuthPolicy({
        isMockMode: false,
        localAuthBypass: "false",
      }),
    ).toEqual({ bypassEnabled: false, oboToken: null });
  });

  it("provides a local bearer token after explicit opt-in", () => {
    expect(
      resolveLocalAuthPolicy({
        isMockMode: false,
        localAuthBypass: "true",
      }),
    ).toEqual({ bypassEnabled: true, oboToken: "local-dev" });
  });

  it("never enables the bypass inside a NAIS cluster", () => {
    expect(
      resolveLocalAuthPolicy({
        isMockMode: false,
        naisClusterName: "dev-gcp",
        localAuthBypass: "true",
      }),
    ).toEqual({ bypassEnabled: false, oboToken: null });
  });
});
