import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchParams } from "~/schemas/searchSchema";
import { fetchStatsServerFn } from "~/server/actions";
import { usePreviousPeriodStats } from "./usePreviousPeriodStats";

const { params } = vi.hoisted(() => ({ params: {} as Partial<SearchParams> }));
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params }),
}));
vi.mock("~/server/actions", () => ({ fetchStatsServerFn: vi.fn() }));

describe("comparison availability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
    vi.clearAllMocks();
    Object.assign(params, {
      surveyId: "survey-vurdering",
      fromDate: "2026-08-19",
      toDate: "2026-09-01",
      compare: undefined,
    });
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { compare: "none" as const },
    { toDate: "2026-09-08" },
    { fromDate: "2026-02-30" },
  ])("does not fetch misleading comparisons for %j", (overrides) => {
    Object.assign(params, overrides);
    const client = new QueryClient();
    const { result } = renderHook(() => usePreviousPeriodStats(true), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.comparisonEnabled).toBe(false);
    expect(result.current.comparisonData).toBeUndefined();
    expect(fetchStatsServerFn).not.toHaveBeenCalled();
  });

  it("fetches today's provisional comparison with the preceding period", () => {
    Object.assign(params, { toDate: "2026-09-07", compare: "previous" });
    const client = new QueryClient();
    vi.mocked(fetchStatsServerFn).mockImplementation(
      () => new Promise(() => {}),
    );
    const { result, unmount } = renderHook(() => usePreviousPeriodStats(true), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.comparisonEnabled).toBe(true);
    expect(result.current.periods?.includesToday).toBe(true);
    expect(params.toDate).toBe("2026-09-07");
    expect(fetchStatsServerFn).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromDate: "2026-07-30",
        toDate: "2026-08-18",
      }),
    });
    unmount();
    client.clear();
  });
});
