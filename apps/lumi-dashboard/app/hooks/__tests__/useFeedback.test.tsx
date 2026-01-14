import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server action module
vi.mock("~/server/actions", () => ({
  fetchFeedbackServerFn: vi.fn(),
}));

// Mock useSearchParams to control URL params
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: { app: "test-app", surveyId: "test-survey" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  })),
}));

import { fetchFeedbackServerFn } from "~/server/actions";
import { useFeedback } from "../useFeedback";

const mockFetchFeedback = fetchFeedbackServerFn as unknown as ReturnType<
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

describe("useFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches feedback data successfully", async () => {
    const mockData = {
      content: [
        {
          id: "1",
          submittedAt: "2024-01-01T00:00:00Z",
          app: "test-app",
          surveyId: "test-survey",
          answers: [],
        },
      ],
      totalPages: 1,
      totalElements: 1,
      size: 20,
      number: 0,
      hasNext: false,
      hasPrevious: false,
    };

    mockFetchFeedback.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useFeedback(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockFetchFeedback).toHaveBeenCalledWith({
      data: expect.objectContaining({
        app: "test-app",
        surveyId: "test-survey",
      }),
    });
  });

  it("handles error state", async () => {
    mockFetchFeedback.mockRejectedValueOnce(new Error("API Error"));

    const { result } = renderHook(() => useFeedback(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("includes correct query parameters", async () => {
    mockFetchFeedback.mockResolvedValueOnce({ content: [] });

    renderHook(() => useFeedback(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetchFeedback).toHaveBeenCalled();
    });

    expect(mockFetchFeedback).toHaveBeenCalledWith({
      data: expect.objectContaining({
        size: "20", // Default page size
      }),
    });
  });
});
