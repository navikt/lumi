import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({
  params: {} as Record<string, string>,
}));

vi.mock("~/server/actions", () => ({
  fetchQuestionTrendServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: search.params }),
}));

import { fetchQuestionTrendServerFn } from "~/server/actions";
import { useQuestionTrend } from "../useQuestionTrend";

const mockFetchTrend = vi.mocked(fetchQuestionTrendServerFn);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function requestedInterval() {
  const [call] = mockFetchTrend.mock.calls;
  return (call?.[0] as { data: { interval: string } } | undefined)?.data
    .interval;
}

describe("useQuestionTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTrend.mockResolvedValue({} as never);
  });

  it("asks for weeks when the period is longer than 92 days and no interval is chosen", async () => {
    search.params = {
      surveyId: "survey-1",
      trendField: "rating",
      fromDate: "2026-01-01",
      toDate: "2026-06-30",
    };

    renderHook(() => useQuestionTrend(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockFetchTrend).toHaveBeenCalled());
    expect(requestedInterval()).toBe("week");
  });

  it("asks for the interval the viewer chose", async () => {
    search.params = {
      surveyId: "survey-1",
      trendField: "rating",
      fromDate: "2026-01-01",
      toDate: "2026-06-30",
      trendInterval: "day",
    };

    renderHook(() => useQuestionTrend(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockFetchTrend).toHaveBeenCalled());
    expect(requestedInterval()).toBe("day");
  });
});
