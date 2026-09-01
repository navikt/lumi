import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterBootstrapResponse } from "~/types/schemas";

vi.mock("~/server/actions", () => ({
  fetchFilterBootstrapServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: { team: "team-test" } }),
}));

import { fetchFilterBootstrapServerFn } from "~/server/actions";
import {
  FILTER_BOOTSTRAP_CACHE_TTL_MS,
  getFilterBootstrapRefetchInterval,
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
});
