import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlexJarStatus } from "../../../../core/types.js";
import { useAutoCloseOnSuccess } from "../useAutoCloseOnSuccess.js";

describe("useAutoCloseOnSuccess", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onClose after delayMs when status is success and enabled", () => {
    const onClose = vi.fn();

    renderHook(() =>
      useAutoCloseOnSuccess({
        enabled: true,
        status: "success",
        delayMs: 1000,
        onClose,
      }),
    );

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when disabled", () => {
    const onClose = vi.fn();

    renderHook(() =>
      useAutoCloseOnSuccess({
        enabled: false,
        status: "success",
        delayMs: 1000,
        onClose,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose when status is not success", () => {
    const onClose = vi.fn();

    const { rerender } = renderHook(
      ({ status }: { status: FlexJarStatus }) =>
        useAutoCloseOnSuccess({
          enabled: true,
          status,
          delayMs: 1000,
          onClose,
        }),
      { initialProps: { status: "idle" as FlexJarStatus } },
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).not.toHaveBeenCalled();

    rerender({ status: "submitting" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).not.toHaveBeenCalled();

    rerender({ status: "error" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears timeout on unmount", () => {
    const onClose = vi.fn();

    const { unmount } = renderHook(() =>
      useAutoCloseOnSuccess({
        enabled: true,
        status: "success",
        delayMs: 1000,
        onClose,
      }),
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("respects custom delayMs value", () => {
    const onClose = vi.fn();

    renderHook(() =>
      useAutoCloseOnSuccess({
        enabled: true,
        status: "success",
        delayMs: 2500,
        onClose,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
