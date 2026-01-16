import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEnrichedContext } from "../useEnrichedContext.js";

describe("useEnrichedContext", () => {
  it("updates pathname/url when history.pushState changes route", async () => {
    window.history.replaceState({}, "", "/");

    const { result } = renderHook(() =>
      useEnrichedContext({ tags: { rolle: "test" } }),
    );

    await waitFor(() => {
      expect(result.current.pathname).toBe("/");
    });

    act(() => {
      window.history.pushState({}, "", "/next");
    });

    await waitFor(() => {
      expect(result.current.pathname).toBe("/next");
      expect(result.current.url).toContain("/next");
    });
  });

  it("updates viewport and deviceType on resize", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    Object.defineProperty(window, "innerWidth", {
      value: 500,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 900,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useEnrichedContext());

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.viewport).toEqual({ width: 500, height: 900 });
      expect(result.current.deviceType).toBe("mobile");
    });

    Object.defineProperty(window, "innerWidth", {
      value: originalWidth,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: originalHeight,
      configurable: true,
      writable: true,
    });
  });
});
