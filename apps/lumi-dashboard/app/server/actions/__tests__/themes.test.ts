import { describe, expect, it } from "vitest";

import { themeNameExists } from "../themes";

describe("mock theme name conflicts", () => {
  it("matches the API's exact, team-scoped uniqueness rule", () => {
    expect(themeNameExists("Søknad", "team-esyfo")).toBe(true);
    expect(themeNameExists("søknad", "team-esyfo")).toBe(false);
    expect(themeNameExists("Søknad", "another-team")).toBe(false);
    expect(
      themeNameExists(
        "Søknad",
        "team-esyfo",
        "33333333-3333-3333-3333-333333333333",
      ),
    ).toBe(false);
  });
});
