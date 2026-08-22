import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../storageAdapters.js", () => ({
  getStorageAdapter: () => storageMocks,
}));

import { usePersistedDismissal } from "../usePersistedDismissal.js";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderDismissalHook = () =>
  renderHook(() =>
    usePersistedDismissal({
      surveyId: "test-survey",
      initialOpen: true,
      dismissCooldownDays: 0,
      resetOnClose: false,
      onReset: vi.fn(),
      storageStrategy: "consent",
    }),
  );

describe("usePersistedDismissal consent loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storageMocks.read.mockReset();
    storageMocks.write.mockReset().mockResolvedValue({ outcome: "applied" });
    storageMocks.remove.mockReset().mockResolvedValue({ outcome: "applied" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops blocking rendering while a consent read is still pending", async () => {
    const pendingRead = createDeferred<string | null>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.dismissed).toBe(false);

    await act(async () => {
      pendingRead.resolve(
        JSON.stringify({
          version: 1,
          state: "dismissed",
          resumeAt: null,
          hideCompletely: true,
        }),
      );
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(true);
  });

  it("does not let a late consent read override user interaction", async () => {
    const pendingRead = createDeferred<string | null>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.closeDock(true);
    });
    act(() => {
      result.current.reopenDock();
    });

    await act(async () => {
      pendingRead.resolve(
        JSON.stringify({
          version: 1,
          state: "dismissed",
          resumeAt: null,
          hideCompletely: true,
        }),
      );
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(false);
    expect(result.current.shouldHideCompletely).toBe(false);
  });

  it("does not let a late consent read override survey interaction", async () => {
    const pendingRead = createDeferred<string | null>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.markUserInteraction();
    });

    await act(async () => {
      pendingRead.resolve(
        JSON.stringify({
          version: 1,
          state: "dismissed",
          resumeAt: null,
          hideCompletely: true,
        }),
      );
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(false);
    expect(result.current.shouldHideCompletely).toBe(false);
  });

  it("does not remove a new dismissal after reading an expired old value", async () => {
    const pendingRead = createDeferred<string | null>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.closeDock(true);
    });

    await act(async () => {
      pendingRead.resolve(
        JSON.stringify({
          version: 1,
          state: "dismissed",
          resumeAt: "2000-01-01T00:00:00.000Z",
          hideCompletely: false,
        }),
      );
      await pendingRead.promise;
    });

    expect(storageMocks.write).toHaveBeenCalledOnce();
    expect(storageMocks.remove).not.toHaveBeenCalled();
    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(true);
  });

  it("clears the render grace when storage responds first", async () => {
    storageMocks.read.mockResolvedValue(null);
    const { result } = renderDismissalHook();

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the render grace when the hook unmounts", () => {
    storageMocks.read.mockReturnValue(createDeferred<string | null>().promise);
    const { unmount } = renderDismissalHook();

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
