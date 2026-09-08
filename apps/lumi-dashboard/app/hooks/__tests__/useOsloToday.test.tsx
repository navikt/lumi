import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOsloToday } from "../useOsloToday";

describe("useOsloToday", () => {
  afterEach(() => vi.useRealTimers());
  it("updates a tab left open across Oslo midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T21:59:40Z"));
    const { result, unmount } = renderHook(useOsloToday);
    expect(result.current).toBe("2026-09-07");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe("2026-09-08");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("refreshes after the browser resumes from sleep", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
    const { result } = renderHook(useOsloToday);
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(result.current).toBe("2026-09-08");
  });
});
