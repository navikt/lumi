import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { stats, topTasks } = vi.hoisted(() => ({
  stats: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
  topTasks: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  createLink: (Component: unknown) => Component,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: {} }),
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => stats,
}));

vi.mock("~/hooks/useTopTasksStats", () => ({
  useTopTasksStats: () => topTasks,
}));

vi.mock("~/hooks/useOsloToday", () => ({
  useOsloToday: () => "2026-10-22",
}));

import { useSuccessRateSeries } from "../TimelineChart";

/** Statistics for a period without a start, filtered on a segment. */
function segmentStats(byDate: Record<string, number>) {
  return {
    byDate,
    period: { fromDate: null, toDate: "2026-10-22", days: 0 },
  };
}

function totalAnswers(points: { total: number }[] | undefined) {
  return points?.reduce((sum, point) => sum + point.total, 0);
}

// The statistics filter on segment, and the Top Tasks numbers do not yet.
describe("useSuccessRateSeries with a segment and no start date", () => {
  beforeEach(() => {
    stats.data = undefined;
    topTasks.data = undefined;
  });

  it("keeps the Top Tasks answers from before the segment's first answer", () => {
    stats.data = segmentStats({ "2026-10-20": 10 });
    topTasks.data = {
      dailyStats: {
        "2026-10-01": { total: 90, success: 45 },
        "2026-10-20": { total: 10, success: 5 },
      },
    };

    const { result } = renderHook(() => useSuccessRateSeries());

    expect(result.current.series?.points[0]?.start).toBe("2026-10-01");
    expect(totalAnswers(result.current.series?.points)).toBe(100);
  });

  it("shows the Top Tasks answers when the segment has none", () => {
    stats.data = segmentStats({});
    topTasks.data = {
      dailyStats: { "2026-10-01": { total: 3, success: 1 } },
    };

    const { result } = renderHook(() => useSuccessRateSeries());

    expect(result.current.isPending).toBe(false);
    expect(totalAnswers(result.current.series?.points)).toBe(3);
  });
});
