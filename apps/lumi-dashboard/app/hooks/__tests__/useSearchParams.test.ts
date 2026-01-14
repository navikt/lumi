import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSearchParams } from "~/hooks/useSearchParams";

describe("useSearchParams", () => {
  beforeEach(() => {
    // Reset URL before each test
    window.history.pushState({}, "", "/");
  });

  it("returns empty params when URL has no search params", () => {
    const { result } = renderHook(() => useSearchParams());
    expect(result.current.params).toEqual({});
  });

  it("parses existing search params from URL", () => {
    window.history.pushState({}, "", "/?team=flex&app=spinnsyn");

    const { result } = renderHook(() => useSearchParams());

    expect(result.current.params.team).toBe("flex");
    expect(result.current.params.app).toBe("spinnsyn");
  });

  it("setParam adds a new parameter", () => {
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.setParam("team", "flex");
    });

    expect(window.location.search).toBe("?team=flex");
    expect(result.current.params.team).toBe("flex");
  });

  it("setParam removes parameter when value is undefined", () => {
    window.history.pushState({}, "", "/?team=flex&app=spinnsyn");
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.setParam("team", undefined);
    });

    expect(window.location.search).toBe("?app=spinnsyn");
    expect(result.current.params.team).toBeUndefined();
  });

  it("setParam removes parameter when value is empty string", () => {
    window.history.pushState({}, "", "/?team=flex");
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.setParam("team", "");
    });

    expect(window.location.search).toBe("");
  });

  it("setParams sets multiple parameters at once", () => {
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.setParams({
        team: "flex",
        app: "spinnsyn",
        fromDate: "2024-01-01",
      });
    });

    expect(result.current.params.team).toBe("flex");
    expect(result.current.params.app).toBe("spinnsyn");
    expect(result.current.params.fromDate).toBe("2024-01-01");
  });

  it("resetParams clears all parameters", () => {
    window.history.pushState(
      {},
      "",
      "/?team=flex&app=spinnsyn&fromDate=2024-01-01",
    );
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.resetParams();
    });

    expect(window.location.search).toBe("");
    expect(result.current.params).toEqual({});
  });

  it("handles special characters in parameter values", () => {
    const { result } = renderHook(() => useSearchParams());

    act(() => {
      result.current.setParam("query", "søk med æøå");
    });

    expect(result.current.params.query).toBe("søk med æøå");
  });
});
