import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeAxis } from "~/utils/timeBuckets";
import { successRateSeries, useSuccessRateSeries } from "../TimelineChart";

const { topTasks, seriesWindow } = vi.hoisted(() => ({
  topTasks: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
  seriesWindow: {
    window: undefined as { from: string; to: string } | undefined,
    interval: "day",
    isPending: false,
    isPlaceholderData: false,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  createLink: (Component: unknown) => Component,
}));

vi.mock("~/hooks/useTopTasksStats", () => ({
  useTopTasksStats: () => topTasks,
}));

vi.mock("~/hooks/useSeriesWindow", () => ({
  useSeriesWindow: () => seriesWindow,
}));

describe("successRateSeries", () => {
  it("puts every bucket on the axis and skips keys that are not dates", () => {
    const series = successRateSeries(
      buildTimeAxis({ from: "2026-10-19", to: "2026-10-21" }, "day"),
      {
        "2026-10-19": { total: 3, success: 2 },
        nonsense: { total: 9, success: 9 },
      },
    );

    expect(
      series.points.map(({ start, total, success, rate }) => ({
        start,
        total,
        success,
        rate,
      })),
    ).toEqual([
      { start: "2026-10-19", total: 3, success: 2, rate: (2 / 3) * 100 },
      { start: "2026-10-20", total: 0, success: 0, rate: null },
      { start: "2026-10-21", total: 0, success: 0, rate: null },
    ]);
  });
});

describe("useSuccessRateSeries", () => {
  beforeEach(() => {
    topTasks.data = undefined;
    topTasks.isPending = false;
    topTasks.isPlaceholderData = false;
    seriesWindow.window = undefined;
    seriesWindow.interval = "day";
    seriesWindow.isPending = false;
    seriesWindow.isPlaceholderData = false;
  });

  it("keeps the previous numbers in their own window until both queries have loaded", () => {
    seriesWindow.window = { from: "2026-10-01", to: "2026-10-07" };
    topTasks.data = { dailyStats: { "2026-10-02": { total: 2, success: 1 } } };
    const { result, rerender } = renderHook(() => useSuccessRateSeries());
    const first = result.current.series;
    expect(first?.interval).toBe("day");

    // A longer period: the statistics have loaded, the Top Tasks numbers
    // are still the previous ones.
    seriesWindow.window = { from: "2025-11-01", to: "2026-10-07" };
    seriesWindow.interval = "week";
    topTasks.isPlaceholderData = true;
    rerender();
    expect(result.current.series).toBe(first);
    expect(result.current.isStale).toBe(true);

    // And the other way round.
    topTasks.isPlaceholderData = false;
    topTasks.data = { dailyStats: { "2026-03-02": { total: 5, success: 5 } } };
    seriesWindow.isPlaceholderData = true;
    rerender();
    expect(result.current.series).toBe(first);

    seriesWindow.isPlaceholderData = false;
    rerender();
    expect(result.current.series?.interval).toBe("week");
    expect(
      result.current.series?.points.find((point) => point.total > 0)?.start,
    ).toBe("2026-03-02");
  });

  it("is pending until both the numbers and the window have loaded", () => {
    topTasks.isPending = true;
    const { result, rerender } = renderHook(() => useSuccessRateSeries());
    expect(result.current).toMatchObject({
      series: undefined,
      isPending: true,
    });

    topTasks.isPending = false;
    topTasks.data = { dailyStats: {} };
    seriesWindow.isPending = true;
    rerender();
    expect(result.current.isPending).toBe(true);
  });

  it("waits rather than mixing numbers and a window that do not belong together", () => {
    // The chart mounts while the statistics for new filters load, so no
    // series has loaded yet.
    seriesWindow.window = { from: "2025-11-01", to: "2026-10-07" };
    seriesWindow.interval = "week";
    seriesWindow.isPlaceholderData = true;
    topTasks.data = {
      dailyStats: { "2026-10-02": { total: 10, success: 10 } },
    };

    const { result } = renderHook(() => useSuccessRateSeries());

    expect(result.current).toMatchObject({
      series: undefined,
      isPending: true,
    });
  });
});
