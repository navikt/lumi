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

describe("resolveConfig placement", () => {
  it("keeps the minimized button and the default stacking order by default", () => {
    const config = resolveConfig();

    expect(config.zIndex).toBe(1000);
    expect(config.hideMinimizedButton).toBe(false);
  });

  it("uses an integer zIndex and ignores other values", () => {
    expect(resolveConfig(undefined, undefined, { zIndex: 997 }).zIndex).toBe(
      997,
    );
    expect(resolveConfig(undefined, undefined, { zIndex: 0 }).zIndex).toBe(0);
    expect(resolveConfig(undefined, undefined, { zIndex: 1.5 }).zIndex).toBe(
      1000,
    );
    expect(
      resolveConfig(undefined, undefined, { zIndex: Number.NaN }).zIndex,
    ).toBe(1000);
  });
});
