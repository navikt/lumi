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

import type { StorageReadResult } from "../../../shared/consentStorage.js";
import { usePersistedDismissal } from "../usePersistedDismissal.js";

const found = (value: Record<string, unknown>): StorageReadResult => ({
  outcome: "found",
  value: JSON.stringify(value),
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const renderDismissalHook = (
  options: Partial<Parameters<typeof usePersistedDismissal>[0]> = {},
) =>
  renderHook(() =>
    usePersistedDismissal({
      surveyId: "test-survey",
      initialOpen: true,
      dismissCooldownDays: 0,
      resetOnClose: false,
      onReset: vi.fn(),
      storageStrategy: "consent",
      ...options,
    }),
  );

const writtenPayload = (call = 0) =>
  JSON.parse(storageMocks.write.mock.calls[call]?.[1] as string) as Record<
    string,
    unknown
  >;

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

  it("shows the minimized trigger while a consent read is still pending", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Opening now could mean minimizing again seconds later.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(false);

    await act(async () => {
      pendingRead.resolve(
        found({
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

  it("opens when a late read shows that storage works and holds nothing", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.dismissed).toBe(true);

    await act(async () => {
      pendingRead.resolve({ outcome: "empty" });
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(false);
  });

  it("keeps initialOpen false minimized after a late empty read", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook({ initialOpen: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      pendingRead.resolve({ outcome: "empty" });
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(true);
  });

  it("stays minimized when a late read reports that nothing can be stored", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      pendingRead.resolve({
        outcome: "unavailable",
        error: new Error("NAV consent API is unavailable"),
      });
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(false);
  });

  it("does not let a late consent read override user interaction", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.reopenDock();
    });
    act(() => {
      result.current.closeDock(true);
    });
    act(() => {
      result.current.reopenDock();
    });

    await act(async () => {
      pendingRead.resolve(
        found({
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

  it("does not let a late read hide a trigger the user has touched", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
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
        found({
          version: 1,
          state: "dismissed",
          resumeAt: null,
          hideCompletely: true,
        }),
      );
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(false);
  });

  it("does not let a late empty read reopen a survey the user closed", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => {
      result.current.reopenDock();
    });
    act(() => {
      result.current.closeDock(false);
    });

    await act(async () => {
      pendingRead.resolve({ outcome: "empty" });
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(true);
  });

  it("does not remove a new dismissal after reading an expired old value", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    act(() => {
      result.current.reopenDock();
    });
    act(() => {
      result.current.closeDock(true);
    });
    storageMocks.remove.mockClear();

    await act(async () => {
      pendingRead.resolve(
        found({
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
    storageMocks.read.mockResolvedValue({ outcome: "empty" });
    const { result } = renderDismissalHook();

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.dismissed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the render grace when the hook unmounts", () => {
    storageMocks.read.mockReturnValue(
      createDeferred<StorageReadResult>().promise,
    );
    const { unmount } = renderDismissalHook();

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not count a view before the stored state is known", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const onViewDock = vi.fn();
    renderDismissalHook({ events: { onViewDock } });

    expect(onViewDock).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onViewDock).not.toHaveBeenCalled();

    await act(async () => {
      pendingRead.resolve({ outcome: "empty" });
      await pendingRead.promise;
    });

    expect(onViewDock).toHaveBeenCalledOnce();
  });
});

describe("usePersistedDismissal storage availability", () => {
  beforeEach(() => {
    storageMocks.read.mockReset();
    storageMocks.write.mockReset().mockResolvedValue({ outcome: "applied" });
    storageMocks.remove.mockReset().mockResolvedValue({ outcome: "applied" });
  });

  it.each(["consent", "localStorage"] as const)(
    "starts minimized when %s storage cannot store",
    async (storageStrategy) => {
      storageMocks.read.mockResolvedValue({
        outcome: "unavailable",
        error: new Error("storage unavailable"),
      });
      const onDismissalPersistFailed = vi.fn();
      const { result } = renderDismissalHook({
        storageStrategy,
        events: { onDismissalPersistFailed },
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.dismissed).toBe(true);
      expect(result.current.shouldHideCompletely).toBe(false);
      // Reading is not a persistence attempt and must stay silent.
      expect(onDismissalPersistFailed).not.toHaveBeenCalled();
    },
  );

  it("follows initialOpen when storage works but holds no value", async () => {
    storageMocks.read.mockResolvedValue({ outcome: "empty" });
    const { result } = renderDismissalHook({ storageStrategy: "localStorage" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.dismissed).toBe(false);
  });
});

describe("usePersistedDismissal after a successful submit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
    storageMocks.read.mockReset().mockResolvedValue({ outcome: "empty" });
    storageMocks.write.mockReset().mockResolvedValue({ outcome: "applied" });
    storageMocks.remove.mockReset().mockResolvedValue({ outcome: "applied" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores the dismissal closing would store, without closing the receipt", async () => {
    const { result } = renderDismissalHook({ dismissCooldownDays: 30 });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.persistSubmission(true);
      await Promise.resolve();
    });

    expect(result.current.dismissed).toBe(false);
    expect(storageMocks.write).toHaveBeenCalledOnce();
    expect(storageMocks.write.mock.calls[0]?.[0]).toBe(
      "lumi-dismissed-test-survey",
    );
    expect(writtenPayload()).toEqual({
      version: 1,
      state: "dismissed",
      dismissedAt: "2026-10-01T12:00:00.000Z",
      resumeAt: "2026-10-31T12:00:00.000Z",
      hideCompletely: true,
    });
  });

  it("keeps the dismissal without expiry when the cooldown is zero", async () => {
    const { result } = renderDismissalHook({ dismissCooldownDays: 0 });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.persistSubmission(false);
      await Promise.resolve();
    });

    expect(writtenPayload()).toMatchObject({
      resumeAt: null,
      hideCompletely: false,
    });
  });

  it("does not write the same dismissal again when the receipt is closed", async () => {
    const { result } = renderDismissalHook();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.persistSubmission(true);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.closeDock(true);
      await Promise.resolve();
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.shouldHideCompletely).toBe(true);
    expect(storageMocks.write).toHaveBeenCalledOnce();
  });

  it("removes the stored submit when the user reopens a minimized receipt", async () => {
    const { result } = renderDismissalHook();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.persistSubmission(false);
      await Promise.resolve();
    });
    act(() => {
      result.current.closeDock(false);
    });
    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });

    expect(storageMocks.write).toHaveBeenCalledOnce();
    expect(storageMocks.remove).toHaveBeenCalledOnce();
    expect(result.current.dismissed).toBe(false);
  });

  it("does not let a late expired read remove the stored submit", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const { result } = renderDismissalHook();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => {
      result.current.reopenDock();
    });
    storageMocks.remove.mockClear();
    act(() => {
      result.current.persistSubmission(true);
    });

    await act(async () => {
      pendingRead.resolve(
        found({
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
    // The receipt stays on screen until the user closes it.
    expect(result.current.dismissed).toBe(false);
  });
});

describe("usePersistedDismissal reopening without a stored value", () => {
  beforeEach(() => {
    storageMocks.read.mockReset();
    storageMocks.write.mockReset().mockResolvedValue({ outcome: "applied" });
    storageMocks.remove.mockReset().mockResolvedValue({
      outcome: "failed",
      error: new Error("Survey storage consent has not been granted"),
    });
  });

  it("skips the removal, and its failure event, when storage could not be read", async () => {
    storageMocks.read.mockResolvedValue({
      outcome: "unavailable",
      error: new Error("Survey storage consent has not been granted"),
    });
    const onDismissalPersistFailed = vi.fn();
    const { result } = renderDismissalHook({
      events: { onDismissalPersistFailed },
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });

    expect(result.current.dismissed).toBe(false);
    expect(storageMocks.remove).not.toHaveBeenCalled();
    expect(onDismissalPersistFailed).not.toHaveBeenCalled();
  });

  it("still clears a dismissal written in this session", async () => {
    storageMocks.read.mockResolvedValue({
      outcome: "unavailable",
      error: new Error("Survey storage consent has not been granted"),
    });
    const { result } = renderDismissalHook();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.reopenDock();
    });
    act(() => {
      result.current.closeDock(false);
    });
    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });

    expect(storageMocks.write).toHaveBeenCalledOnce();
    expect(storageMocks.remove).toHaveBeenCalledOnce();
  });

  it("skips the removal when the user reopens before an unavailable read answers", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    const onDismissalPersistFailed = vi.fn();
    // Minimized from the start, so the user can open it at once.
    const { result } = renderDismissalHook({
      initialOpen: false,
      events: { onDismissalPersistFailed },
    });

    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });
    await act(async () => {
      pendingRead.resolve({
        outcome: "unavailable",
        error: new Error("NAV consent API is unavailable"),
      });
      await pendingRead.promise;
    });

    expect(result.current.dismissed).toBe(false);
    expect(storageMocks.remove).not.toHaveBeenCalled();
    expect(onDismissalPersistFailed).not.toHaveBeenCalled();
  });

  it("clears an older dismissal a late read finds after the user reopened", async () => {
    const pendingRead = createDeferred<StorageReadResult>();
    storageMocks.read.mockReturnValue(pendingRead.promise);
    storageMocks.remove.mockResolvedValue({ outcome: "applied" });
    const { result } = renderDismissalHook({ initialOpen: false });

    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });
    expect(storageMocks.remove).not.toHaveBeenCalled();

    await act(async () => {
      pendingRead.resolve(
        found({ version: 1, state: "dismissed", resumeAt: null }),
      );
      await pendingRead.promise;
    });

    expect(storageMocks.remove).toHaveBeenCalledOnce();
    expect(result.current.dismissed).toBe(false);
  });

  it("still clears a dismissal found in storage", async () => {
    storageMocks.read.mockResolvedValue(
      found({ version: 1, state: "dismissed", resumeAt: null }),
    );
    const { result } = renderDismissalHook();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.reopenDock();
      await Promise.resolve();
    });

    expect(storageMocks.remove).toHaveBeenCalledOnce();
  });
});
