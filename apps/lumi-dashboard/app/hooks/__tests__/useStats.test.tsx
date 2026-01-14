import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server action module
vi.mock("~/server/actions", () => ({
  fetchStatsServerFn: vi.fn(),
}));

// Mock useSearchParams
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: { app: "test-app", surveyId: "test-survey" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  })),
}));

import { fetchStatsServerFn } from "~/server/actions";
import { useStats } from "../useStats";

const mockFetchStats = fetchStatsServerFn as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches stats data successfully", async () => {
    const mockData = {
      totalCount: 100,
      countWithText: 50,
      countWithoutText: 50,
      byRating: { "1": 10, "2": 15, "3": 25, "4": 30, "5": 20 },
      byApp: { "test-app": 100 },
      byDate: {},
      bySurveyId: {},
      averageRating: 3.5,
      period: { fromDate: "2024-01-01", toDate: "2024-12-31", days: 365 },
      surveyType: "rating",
    };

    mockFetchStats.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.data?.totalCount).toBe(100);
    expect(result.current.data?.surveyType).toBe("rating");
  });

  it("correctly calculates averageRating from data", async () => {
    const mockData = {
      totalCount: 50,
      countWithText: 25,
      countWithoutText: 25,
      byRating: { "1": 5, "2": 10, "3": 15, "4": 10, "5": 10 },
      byApp: {},
      byDate: {},
      bySurveyId: {},
      averageRating: 3.2,
      period: null,
      surveyType: null,
    };

    mockFetchStats.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.averageRating).toBe(3.2);
  });

  it("handles empty stats", async () => {
    const mockData = {
      totalCount: 0,
      countWithText: 0,
      countWithoutText: 0,
      byRating: {},
      byApp: {},
      byDate: {},
      bySurveyId: {},
      averageRating: null,
      period: null,
      surveyType: null,
    };

    mockFetchStats.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.totalCount).toBe(0);
    expect(result.current.data?.averageRating).toBeNull();
  });
});
