import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/actions", () => ({
  archiveSurveyServerFn: vi.fn(),
  unarchiveSurveyServerFn: vi.fn(),
}));

const { mockParams, mockSetParams } = vi.hoisted(() => ({
  mockParams: { team: "team-test", surveyId: "survey-1" },
  mockSetParams: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: mockParams,
    setParam: vi.fn(),
    setParams: mockSetParams,
    resetParams: vi.fn(),
  })),
}));

import {
  archiveSurveyServerFn,
  unarchiveSurveyServerFn,
} from "~/server/actions";
import { useArchiveSurvey } from "../useArchiveSurvey";

const mockArchive = archiveSurveyServerFn as unknown as ReturnType<
  typeof vi.fn
>;
const mockUnarchive = unarchiveSurveyServerFn as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
    },
  });
}

describe("useArchiveSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives the survey for the selected team and refreshes bootstrap data", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockArchive.mockResolvedValueOnce({
      surveyId: "survey-1",
      archivedAt: "2026-08-09T12:00:00Z",
      archivedBy: "A123456",
    });

    const { result } = renderHook(() => useArchiveSurvey(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.archiveMutation.mutateAsync("survey-1");
    });

    expect(mockArchive).toHaveBeenCalledWith({
      data: { surveyId: "survey-1", team: "team-test" },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["filterBootstrap"],
    });
    expect(mockSetParams).toHaveBeenCalledWith({ showArchived: "true" });
  });

  it("restores the survey for the selected team and refreshes bootstrap data", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockUnarchive.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useArchiveSurvey(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.restoreMutation.mutateAsync("survey-1");
    });

    expect(mockUnarchive).toHaveBeenCalledWith({
      data: { surveyId: "survey-1", team: "team-test" },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["filterBootstrap"],
    });
  });

  it("resets a restore error when the selected survey changes", async () => {
    const queryClient = createQueryClient();
    mockUnarchive.mockRejectedValueOnce(new Error("restore failed"));

    const { result, rerender } = renderHook(
      ({ surveyId }) => useArchiveSurvey(surveyId),
      {
        initialProps: { surveyId: "survey-1" },
        wrapper: createWrapper(queryClient),
      },
    );

    act(() => {
      result.current.restoreMutation.mutate("survey-1");
    });
    await waitFor(() =>
      expect(result.current.restoreMutation.isError).toBe(true),
    );

    rerender({ surveyId: "survey-2" });

    await waitFor(() =>
      expect(result.current.restoreMutation.isError).toBe(false),
    );
  });
});
