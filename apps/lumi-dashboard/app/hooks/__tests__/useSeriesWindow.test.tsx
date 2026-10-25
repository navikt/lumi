import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockParams, mockStats, mockAnswerSpan } = vi.hoisted(() => ({
  mockParams: {} as Record<string, string | undefined>,
  mockStats: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
  mockAnswerSpan: {
    value: undefined as { fromDate: string; toDate: string } | undefined,
  },
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: mockParams }),
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => mockStats,
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => mockAnswerSpan.value,
}));

vi.mock("~/hooks/useOsloToday", () => ({
  useOsloToday: () => "2026-10-22",
}));

import { useSeriesWindow } from "../useSeriesWindow";

function stats(
  byDate: Record<string, number>,
  period: { fromDate: string | null; toDate: string | null },
  retentionStartDate?: string,
) {
  return { byDate, period: { ...period, days: 0 }, retentionStartDate };
}

describe("useSeriesWindow", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParams)) delete mockParams[key];
    mockStats.data = undefined;
    mockStats.isPending = false;
    mockStats.isPlaceholderData = false;
    mockAnswerSpan.value = undefined;
  });

  it("has no window before the statistics have loaded", () => {
    mockParams.fromDate = "2026-01-01";
    mockParams.toDate = "2026-06-30";
    mockStats.isPending = true;

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });

  it("follows the period of the statistics on screen while new ones load", () => {
    mockParams.fromDate = "2026-10-01";
    mockParams.toDate = "2026-10-22";
    mockStats.isPlaceholderData = true;
    mockStats.data = stats(
      { "2026-02-03": 1 },
      { fromDate: "2026-01-01", toDate: "2026-06-30" },
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-01-01",
      to: "2026-06-30",
    });
    expect(result.current.interval).toBe("week");
  });

  it("counts answers dated after the browser's today", () => {
    mockStats.data = stats(
      { "2026-10-20": 1, "2026-10-23": 2 },
      { fromDate: "2026-10-01", toDate: "2026-10-31" },
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-10-01",
      to: "2026-10-23",
    });
  });

  it("starts with the week of the first answer when the period has no start", () => {
    mockStats.data = stats(
      { "2025-11-05": 1, "2026-09-30": 1 },
      { fromDate: null, toDate: "2026-10-01" },
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2025-11-03",
      to: "2026-10-01",
    });
    expect(result.current.interval).toBe("week");
  });

  it("starts a period without a start at the first answer for the selection", () => {
    // Filters the bootstrap does not apply leave the first days empty.
    mockStats.data = stats(
      { "2026-10-20": 1 },
      { fromDate: null, toDate: "2026-10-22" },
    );
    mockAnswerSpan.value = { fromDate: "2026-10-01", toDate: "2026-10-21" };

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-10-01",
      to: "2026-10-22",
    });
  });

  it("starts on the day of the first answer, also in the middle of a week", () => {
    // Weekly: from Wednesday 1 July to 25 October 2026.
    mockStats.data = stats(
      { "2026-08-03": 1 },
      { fromDate: null, toDate: "2026-10-22" },
    );
    mockAnswerSpan.value = { fromDate: "2026-07-01", toDate: "2026-10-21" };

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window?.from).toBe("2026-07-01");
    expect(result.current.interval).toBe("week");
  });

  it("keeps the first answer the previous numbers were shown with while new ones load", () => {
    const shown = stats(
      { "2026-08-20": 1 },
      { fromDate: null, toDate: "2026-10-22" },
    );
    mockStats.data = shown;
    mockAnswerSpan.value = { fromDate: "2026-06-01", toDate: "2026-10-21" };
    const { result, rerender } = renderHook(() => useSeriesWindow());
    expect(result.current.window?.from).toBe("2026-06-01");

    // Another survey: its first answer is known, its numbers are not yet.
    mockStats.isPlaceholderData = true;
    mockAnswerSpan.value = { fromDate: "2026-09-01", toDate: "2026-10-21" };
    rerender();

    expect(result.current.window?.from).toBe("2026-06-01");
  });

  it("starts with the statistics when the previous numbers were never shown", () => {
    mockStats.isPlaceholderData = true;
    mockStats.data = stats(
      { "2026-10-20": 1 },
      { fromDate: null, toDate: "2026-10-22" },
    );
    mockAnswerSpan.value = { fromDate: "2026-10-01", toDate: "2026-10-21" };

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window?.from).toBe("2026-10-20");
  });

  it("leaves a period with a start to its start date", () => {
    mockStats.data = stats(
      { "2026-10-20": 1 },
      { fromDate: "2026-10-15", toDate: "2026-10-22" },
    );
    mockAnswerSpan.value = { fromDate: "2026-01-01", toDate: "2026-10-21" };

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-10-15",
      to: "2026-10-22",
    });
  });

  it("lets days from other numbers start a period without a start", () => {
    mockStats.data = stats(
      { "2026-10-20": 1 },
      { fromDate: null, toDate: "2026-10-22" },
    );

    const { result } = renderHook(() =>
      useSeriesWindow(["2026-10-01", "nonsense"]),
    );

    expect(result.current.window).toEqual({
      from: "2026-10-01",
      to: "2026-10-22",
    });
  });

  it("starts where answers are kept when the period starts earlier", () => {
    mockStats.data = stats(
      { "2025-10-27": 3, "2025-12-01": 1 },
      { fromDate: "2025-06-01", toDate: "2025-12-31" },
      "2025-10-25",
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2025-10-25",
      to: "2025-12-31",
    });
    expect(result.current.interval).toBe("day");
  });

  it("keeps answers older than the retention start while they are still there", () => {
    mockStats.data = stats(
      { "2025-10-23": 1, "2025-12-01": 1 },
      { fromDate: "2025-06-01", toDate: "2025-12-31" },
      "2025-10-25",
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window?.from).toBe("2025-10-23");
  });

  it("ignores days in the statistics that are not dates", () => {
    mockStats.data = stats(
      { "2026-10-20": 1, nonsense: 2 },
      { fromDate: "2026-10-01", toDate: null },
    );

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-10-01",
      to: "2026-10-22",
    });
  });

  it("uses the dates in the address when the statistics do not say", () => {
    mockParams.fromDate = "2026-09-01";
    mockParams.toDate = "2026-09-30";
    mockStats.data = { byDate: {} };

    const { result } = renderHook(() => useSeriesWindow());

    expect(result.current.window).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(result.current.interval).toBe("day");
  });

  it("returns the same window object on every render", () => {
    mockStats.data = stats(
      { "2026-10-20": 1 },
      { fromDate: "2026-10-01", toDate: "2026-10-22" },
    );

    const { result, rerender } = renderHook(() => useSeriesWindow());
    const first = result.current.window;
    rerender();

    expect(result.current.window).toBe(first);
  });
});
