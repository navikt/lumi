import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/actions", () => ({
  deleteFeedbackServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: { team: "team-test" },
  })),
}));

import { deleteFeedbackServerFn } from "~/server/actions";
import { useDeleteFeedback } from "../useDeleteFeedback";

const mockDeleteFeedback = deleteFeedbackServerFn as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDeleteFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates feedback, stats, bootstrap, and survey count after deletion", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockDeleteFeedback.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteFeedback(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("feedback-1");
    });

    expect(mockDeleteFeedback).toHaveBeenCalledWith({
      data: { id: "feedback-1", team: "team-test" },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["feedback"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["stats"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["filterBootstrap"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["survey-total-count"],
    });
  });
});
