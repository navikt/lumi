import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../resolveConfig.js";

describe("resolveConfig panel height", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the visible viewport where dvh is supported", () => {
    vi.stubGlobal("CSS", {
      supports: (property: string, value: string) =>
        property === "max-height" && value.includes("dvh"),
    });

    expect(resolveConfig().panelMaxHeight).toBe("calc(100dvh - 2rem)");
  });

  it("falls back to vh in browsers without dvh", () => {
    vi.stubGlobal("CSS", { supports: () => false });

    expect(resolveConfig().panelMaxHeight).toBe("calc(100vh - 2rem)");
  });

  it("falls back to vh without the CSS API, as during server rendering", () => {
    vi.stubGlobal("CSS", undefined);

    expect(resolveConfig().panelMaxHeight).toBe("calc(100vh - 2rem)");
  });

  it("keeps an explicit panelMaxHeight", () => {
    expect(
      resolveConfig(undefined, undefined, { panelMaxHeight: "420px" })
        .panelMaxHeight,
    ).toBe("420px");
  });
});
