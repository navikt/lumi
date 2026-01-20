import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEnrichedContext } from "../useEnrichedContext.js";

describe("useEnrichedContext", () => {
  it("does not auto-collect url/pathname (privacy)", async () => {
    window.history.replaceState({}, "", "/");

    const { result } = renderHook(() => useEnrichedContext());

    await waitFor(() => {
      expect(result.current.pathname).toBeUndefined();
      expect(result.current.url).toBeUndefined();
    });
  });

  it("auto-collects pathname when opted in", async () => {
    window.history.replaceState({}, "", "/some-route");

    const { result } = renderHook(() =>
      useEnrichedContext(undefined, { collectLocation: true }),
    );

    await waitFor(() => {
      expect(result.current.pathname).toBe("/some-route");
    });
  });

  it("passes through user-provided url/pathname", async () => {
    const { result } = renderHook(() =>
      useEnrichedContext(
        {
          pathname: "/oppfolgingsplan/:uuid",
          url: "https://example.test/oppfolgingsplan/:uuid",
          tags: { rolle: "test" },
        },
        { collectLocation: true },
      ),
    );

    await waitFor(() => {
      expect(result.current.pathname).toBe("/oppfolgingsplan/:uuid");
      expect(result.current.url).toBe(
        "https://example.test/oppfolgingsplan/:uuid",
      );
      expect(result.current.tags).toEqual({ rolle: "test" });
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
