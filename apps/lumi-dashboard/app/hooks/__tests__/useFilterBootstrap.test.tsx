import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import type { FilterBootstrapResponse } from "~/types/schemas";

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
}));

const searchState = vi.hoisted(() => ({
  team: "team-test" as string | undefined,
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: { team: searchState.team } }),
}));

import { fetchFilterBootstrapServerFn } from "~/server/actions";
import {
  FILTER_BOOTSTRAP_CACHE_TTL_MS,
  getFilterBootstrapRefetchInterval,
  shouldRetryFilterBootstrap,
  useFilterBootstrap,
} from "../useFilterBootstrap";

const mockFetchFilterBootstrap =
  fetchFilterBootstrapServerFn as unknown as ReturnType<typeof vi.fn>;

function bootstrapResponse(generatedAt: string): FilterBootstrapResponse {
  return {
    generatedAt,
    selectedTeam: "team-test",
    availableTeams: ["team-test"],
    deviceTypes: ["desktop"],
    apps: [],
    surveysByApp: {},
    tags: [],
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createWrapperFor(queryClient);
}

function createWrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useFilterBootstrap", () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    searchState.team = "team-test";
  });

  it("keeps the filters when the default team is written into the URL", async () => {
    searchState.team = undefined;
    mockFetchFilterBootstrap.mockResolvedValue(
      bootstrapResponse("2026-09-01T08:00:00Z"),
    );

    const { result, rerender } = renderHook(() => useFilterBootstrap(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    searchState.team = "team-test";
    rerender();

    expect(result.current.isPending).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.selectedTeam).toBe("team-test");
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(mockFetchFilterBootstrap).toHaveBeenLastCalledWith({
      data: { team: "team-test" },
    });
  });

  it("does not show another team's filters while a new team loads", async () => {
    mockFetchFilterBootstrap.mockResolvedValueOnce(
      bootstrapResponse("2026-09-01T08:00:00Z"),
    );
    mockFetchFilterBootstrap.mockReturnValueOnce(new Promise(() => undefined));

    const { result, rerender } = renderHook(() => useFilterBootstrap(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    searchState.team = "team-other";
    rerender();

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("refetches when the server-generated cache window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T08:00:00Z"));
    mockFetchFilterBootstrap
      .mockResolvedValueOnce(bootstrapResponse("2026-09-01T07:56:00Z"))
      .mockResolvedValueOnce(bootstrapResponse("2026-09-01T08:01:00Z"));

    renderHook(() => useFilterBootstrap(), { wrapper: createWrapper() });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledOnce();

    await act(async () => vi.advanceTimersByTimeAsync(59_999));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledOnce();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledTimes(2);
  });

  it("revalidates on focus after skipping background polling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T08:00:00Z"));
    mockFetchFilterBootstrap.mockResolvedValue(
      bootstrapResponse("2026-09-01T07:56:00Z"),
    );

    renderHook(() => useFilterBootstrap(), { wrapper: createWrapper() });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledOnce();

    focusManager.setFocused(false);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledOnce();

    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockFetchFilterBootstrap).toHaveBeenCalledTimes(2);
  });

  it("revalidates when remounted after being inactive", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T08:00:00Z"));
    mockFetchFilterBootstrap.mockResolvedValue(
      bootstrapResponse("2026-09-01T07:56:00Z"),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = createWrapperFor(queryClient);

    const firstRender = renderHook(() => useFilterBootstrap(), { wrapper });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mockFetchFilterBootstrap).toHaveBeenCalledOnce();

    firstRender.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(2 * 60 * 1000));
    renderHook(() => useFilterBootstrap(), { wrapper });
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(mockFetchFilterBootstrap).toHaveBeenCalledTimes(2);
  });

  it("bounds polling safely when the browser and server clocks disagree", () => {
    expect(
      getFilterBootstrapRefetchInterval(
        "2026-09-01T08:10:00Z",
        Date.parse("2026-09-01T08:00:00Z"),
      ),
    ).toBe(FILTER_BOOTSTRAP_CACHE_TTL_MS);
    expect(getFilterBootstrapRefetchInterval(undefined, Date.now())).toBe(
      FILTER_BOOTSTRAP_CACHE_TTL_MS,
    );
    expect(
      getFilterBootstrapRefetchInterval(
        "2026-09-01T07:50:00Z",
        Date.parse("2026-09-01T08:00:00Z"),
      ),
    ).toBe(60 * 1000);
    expect(
      getFilterBootstrapRefetchInterval(
        "2026-09-01T07:56:00Z",
        Date.parse("2026-09-01T08:00:00Z"),
      ),
    ).toBe(60 * 1000);
    expect(
      getFilterBootstrapRefetchInterval(
        "2026-09-01T07:56:59Z",
        Date.parse("2026-09-01T08:01:00Z"),
      ),
    ).toBe(60 * 1000);
  });

  it("retries safely when an early refetch returns the same cache generation", () => {
    const generatedAt = "2026-09-01T07:55:30Z";

    expect(
      getFilterBootstrapRefetchInterval(
        generatedAt,
        Date.parse("2026-09-01T08:00:00Z"),
      ),
    ).toBe(60 * 1000);
    expect(
      getFilterBootstrapRefetchInterval(
        generatedAt,
        Date.parse("2026-09-01T08:01:00Z"),
      ),
    ).toBe(60 * 1000);
    expect(
      getFilterBootstrapRefetchInterval(
        "2026-09-01T08:01:30Z",
        Date.parse("2026-09-01T08:02:00Z"),
      ),
    ).toBe(4.5 * 60 * 1000);
  });

  it("retries a failed bootstrap once, but not a 4xx answer from the API", () => {
    const apiError = (status: number) =>
      new ApiErrorException({
        status,
        type: ErrorType.AUTHORIZATION_ERROR,
        message: "Melding fra API-et",
        timestamp: "2026-09-01T08:00:00Z",
      });

    expect(shouldRetryFilterBootstrap(0, apiError(403))).toBe(false);
    expect(shouldRetryFilterBootstrap(0, apiError(401))).toBe(false);
    expect(shouldRetryFilterBootstrap(0, apiError(503))).toBe(true);
    expect(shouldRetryFilterBootstrap(1, apiError(503))).toBe(false);
    expect(shouldRetryFilterBootstrap(0, new Error("nettverk"))).toBe(true);
  });
});
