import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEnrichedContext } from "../useEnrichedContext.js";

describe("useEnrichedContext", () => {
  const originalUserAgent = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "userAgent",
  );
  const originalUserAgentData = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "userAgentData",
  );

  afterEach(() => {
    if (originalUserAgent === undefined) {
      Reflect.deleteProperty(Navigator.prototype, "userAgent");
    } else {
      Object.defineProperty(
        Navigator.prototype,
        "userAgent",
        originalUserAgent,
      );
    }

    if (originalUserAgentData === undefined) {
      Reflect.deleteProperty(Navigator.prototype, "userAgentData");
    } else {
      Object.defineProperty(
        Navigator.prototype,
        "userAgentData",
        originalUserAgentData,
      );
    }
  });

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

    Object.defineProperty(Navigator.prototype, "userAgentData", {
      value: { mobile: true, platform: "iOS" },
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

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
      expect(result.current.screenResolution).toEqual({
        width: screen.width,
        height: screen.height,
      });
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
