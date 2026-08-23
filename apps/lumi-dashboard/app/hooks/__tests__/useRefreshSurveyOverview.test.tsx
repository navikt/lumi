import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterBootstrapResponse } from "~/types/schemas";

const { mockNavigate, mockParams, mockRefreshBootstrap } = vi.hoisted(() => ({
  mockRefreshBootstrap: vi.fn(),
  mockNavigate: vi.fn().mockResolvedValue(undefined),
  mockParams: {
    team: "team-test",
    app: "app-a" as string | undefined,
    surveyId: "shared-survey" as string | undefined,
    dateMode: "auto" as "auto" | "fixed" | undefined,
    fromDate: "2024-01-20" as string | undefined,
    toDate: "2024-02-18" as string | undefined,
  },
}));

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
  refreshFilterBootstrapServerFn: mockRefreshBootstrap,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: mockParams }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...original, useNavigate: () => mockNavigate };
});

import { filterBootstrapQueryKey } from "../useFilterBootstrap";
import { useRefreshSurveyOverview } from "../useRefreshSurveyOverview";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function freshBootstrap(): FilterBootstrapResponse {
  return {
    generatedAt: "2026-08-23T10:00:00Z",
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    deviceTypes: ["desktop"],
    apps: ["app-a", "app-b"],
    surveysByApp: {
      "app-a": ["shared-survey"],
      "app-b": ["shared-survey"],
    },
    tags: [],
    surveyMeta: {
      "shared-survey": {
        archivedAt: null,
        firstSubmissionAt: "2024-05-01T12:00:00Z",
        lastSubmissionAt: "2024-05-30T12:00:00Z",
      },
    },
    surveyMetaByApp: {
      "app-a": {
        "shared-survey": {
          archivedAt: null,
          firstSubmissionAt: "2024-03-01T12:00:00Z",
          lastSubmissionAt: "2024-03-20T12:00:00Z",
        },
      },
    },
  };
}

describe("useRefreshSurveyOverview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.team = "team-test";
    mockParams.app = "app-a";
    mockParams.surveyId = "shared-survey";
    mockParams.dateMode = "auto";
    mockParams.fromDate = "2024-01-20";
    mockParams.toDate = "2024-02-18";
  });

  it("forces fresh bootstrap metadata before moving an automatic period and refreshing feedback", async () => {
    const queryClient = createQueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const bootstrap = freshBootstrap();
    mockRefreshBootstrap.mockResolvedValueOnce(bootstrap);

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockRefreshBootstrap).toHaveBeenCalledWith({
      data: { team: "team-test" },
    });
    expect(cancelSpy).toHaveBeenCalledTimes(2);
    expect(cancelSpy).toHaveBeenNthCalledWith(1, {
      queryKey: filterBootstrapQueryKey("team-test"),
      exact: true,
    });
    expect(cancelSpy).toHaveBeenNthCalledWith(2, {
      queryKey: filterBootstrapQueryKey("team-test"),
      exact: true,
    });
    expect(mockNavigate).toHaveBeenCalledOnce();
    const navigation = mockNavigate.mock.calls[0][0];
    expect(
      navigation.search({
        team: "team-test",
        app: "app-a",
        surveyId: "shared-survey",
        dateMode: "auto",
        fromDate: "2024-01-20",
        toDate: "2024-02-18",
      }),
    ).toMatchObject({
      dateMode: "auto",
      fromDate: "2024-03-01",
      toDate: "2024-03-20",
      page: "1",
    });
    expect(
      queryClient.getQueryData(filterBootstrapQueryKey("team-test")),
    ).toEqual(bootstrap);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["feedback"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["stats"] });
    expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockRefreshBootstrap.mock.invocationCallOrder[0],
    );
    expect(mockRefreshBootstrap.mock.invocationCallOrder[0]).toBeLessThan(
      cancelSpy.mock.invocationCallOrder[1],
    );
    expect(cancelSpy.mock.invocationCallOrder[1]).toBeLessThan(
      setQueryDataSpy.mock.invocationCallOrder[0],
    );
    expect(setQueryDataSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    );
    expect(mockNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateSpy.mock.invocationCallOrder[0],
    );
  });

  it("refreshes feedback when an automatic period is already current", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockParams.fromDate = "2024-03-01";
    mockParams.toDate = "2024-03-20";
    mockRefreshBootstrap.mockResolvedValueOnce(freshBootstrap());

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["feedback"] });
  });

  it("moves an unscoped automatic period to the current rolling window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z"));
    const queryClient = createQueryClient();
    mockParams.app = undefined;
    mockParams.surveyId = undefined;
    mockParams.fromDate = "2026-07-24";
    mockParams.toDate = "2026-08-22";
    mockRefreshBootstrap.mockResolvedValueOnce(freshBootstrap());

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    const navigation = mockNavigate.mock.calls[0][0];
    expect(navigation.search({})).toMatchObject({
      dateMode: "auto",
      fromDate: "2026-07-25",
      toDate: "2026-08-23",
      page: "1",
    });
  });

  it("preserves a fixed period while still refreshing metadata and feedback", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockParams.dateMode = "fixed";
    mockParams.fromDate = "2024-01-01";
    mockParams.toDate = "2024-01-31";
    mockRefreshBootstrap.mockResolvedValueOnce(freshBootstrap());

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["feedback"] });
  });

  it("treats legacy explicit dates without a mode as fixed", async () => {
    const queryClient = createQueryClient();
    mockParams.dateMode = undefined;
    mockParams.fromDate = "2024-01-01";
    mockParams.toDate = "2024-01-31";
    mockRefreshBootstrap.mockResolvedValueOnce(freshBootstrap());

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps the existing cached overview when the forced request fails", async () => {
    const queryClient = createQueryClient();
    const existing = freshBootstrap();
    existing.generatedAt = "2026-08-22T10:00:00Z";
    queryClient.setQueryData(filterBootstrapQueryKey("team-test"), existing);
    mockRefreshBootstrap.mockRejectedValueOnce(new Error("refresh failed"));

    const { result } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(act(async () => result.current.mutateAsync())).rejects.toThrow(
      "refresh failed",
    );

    expect(
      queryClient.getQueryData(filterBootstrapQueryKey("team-test")),
    ).toEqual(existing);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not apply a late response to a different team context", async () => {
    const queryClient = createQueryClient();
    let resolveRefresh: (bootstrap: FilterBootstrapResponse) => void = () =>
      undefined;
    mockRefreshBootstrap.mockReturnValueOnce(
      new Promise<FilterBootstrapResponse>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const { result, rerender } = renderHook(() => useRefreshSurveyOverview(), {
      wrapper: createWrapper(queryClient),
    });
    let refreshPromise: Promise<unknown> | undefined;
    act(() => {
      refreshPromise = result.current.mutateAsync();
    });
    await waitFor(() => expect(mockRefreshBootstrap).toHaveBeenCalledOnce());

    mockParams.team = "team-other";
    mockParams.app = "app-b";
    rerender();

    await act(async () => {
      resolveRefresh(freshBootstrap());
      await refreshPromise;
    });

    expect(
      queryClient.getQueryData(filterBootstrapQueryKey("team-test")),
    ).toEqual(freshBootstrap());
    expect(
      queryClient.getQueryData(filterBootstrapQueryKey("team-other")),
    ).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
