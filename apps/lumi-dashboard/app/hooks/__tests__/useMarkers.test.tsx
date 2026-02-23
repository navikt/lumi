import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/actions", () => ({
  fetchMarkersServerFn: vi.fn(),
  createMarkerServerFn: vi.fn(),
  updateMarkerServerFn: vi.fn(),
  deleteMarkerServerFn: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(() => ({
    params: { team: "team-test", fromDate: "2026-01-01", toDate: "2026-01-31" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  })),
}));

import {
  createMarkerServerFn,
  deleteMarkerServerFn,
  fetchMarkersServerFn,
  updateMarkerServerFn,
} from "~/server/actions";
import { useMarkers } from "../useMarkers";

const mockFetchMarkers = fetchMarkersServerFn as unknown as ReturnType<
  typeof vi.fn
>;
const mockCreateMarker = createMarkerServerFn as unknown as ReturnType<
  typeof vi.fn
>;
const mockUpdateMarker = updateMarkerServerFn as unknown as ReturnType<
  typeof vi.fn
>;
const mockDeleteMarker = deleteMarkerServerFn as unknown as ReturnType<
  typeof vi.fn
>;

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useMarkers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMarkers.mockResolvedValue([]);
  });

  it("fetches markers with survey/team/date params", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockFetchMarkers.mockResolvedValueOnce([
      {
        id: "marker-1",
        team: "team-test",
        surveyId: "survey-1",
        markerDate: "2026-01-15",
        label: "Lansering",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);

    const { result } = renderHook(
      () => useMarkers("survey-1", "2026-01-01", "2026-01-31"),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(1);
    expect(mockFetchMarkers).toHaveBeenCalledWith({
      data: {
        surveyId: "survey-1",
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
        team: "team-test",
      },
    });
  });

  it("creates marker and invalidates marker queries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    mockFetchMarkers.mockResolvedValueOnce([]);
    mockCreateMarker.mockResolvedValueOnce({
      id: "marker-2",
      team: "team-test",
      surveyId: "survey-1",
      markerDate: "2026-01-20",
      label: "Ny løsning",
      createdAt: "2026-01-20T09:00:00Z",
      updatedAt: "2026-01-20T09:00:00Z",
    });

    const { result } = renderHook(() => useMarkers("survey-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createMarkerAsync({
        markerDate: "2026-01-20",
        label: "Ny løsning",
      });
    });

    expect(mockCreateMarker).toHaveBeenCalledWith({
      data: {
        surveyId: "survey-1",
        team: "team-test",
        markerDate: "2026-01-20",
        label: "Ny løsning",
      },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["markers"] });
  });

  it("updates and deletes marker with team/survey scope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockFetchMarkers.mockResolvedValueOnce([]);
    mockUpdateMarker.mockResolvedValueOnce({
      id: "marker-3",
      team: "team-test",
      surveyId: "survey-1",
      markerDate: "2026-01-21",
      label: "Oppdatert",
      createdAt: "2026-01-21T09:00:00Z",
      updatedAt: "2026-01-21T10:00:00Z",
    });
    mockDeleteMarker.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMarkers("survey-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateMarkerAsync({
        id: "marker-3",
        label: "Oppdatert",
        clearColor: true,
      });
    });

    await act(async () => {
      await result.current.deleteMarkerAsync("marker-3");
    });

    expect(mockUpdateMarker).toHaveBeenCalledWith({
      data: {
        id: "marker-3",
        surveyId: "survey-1",
        team: "team-test",
        label: "Oppdatert",
        clearColor: true,
      },
    });

    expect(mockDeleteMarker).toHaveBeenCalledWith({
      data: {
        id: "marker-3",
        surveyId: "survey-1",
        team: "team-test",
      },
    });
  });
});
