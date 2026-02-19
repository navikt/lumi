import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/actions", () => ({
  deleteSurveyServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: { team: "team-test" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  })),
}));

import { deleteSurveyServerFn } from "~/server/actions";
import { useDeleteSurvey } from "../useDeleteSurvey";

const mockDeleteSurvey = deleteSurveyServerFn as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDeleteSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes survey and invalidates related queries including markers", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockDeleteSurvey.mockResolvedValueOnce({
      surveyId: "survey-1",
      deletedCount: 10,
    });

    const { result } = renderHook(() => useDeleteSurvey(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("survey-1");
    });

    expect(mockDeleteSurvey).toHaveBeenCalledWith({
      data: {
        surveyId: "survey-1",
        team: "team-test",
      },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["feedback"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["stats"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["surveysByApp"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["filterOptions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["markers"] });
  });
});
