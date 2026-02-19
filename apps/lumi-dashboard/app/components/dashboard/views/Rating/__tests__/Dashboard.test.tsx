import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkers } from "~/hooks/useMarkers";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { RatingDashboard } from "../Dashboard";

vi.mock("~/components/dashboard", () => ({
  ChartCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashboardCard: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DashboardGrid: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/components/dashboard/SegmentBreakdown", () => ({
  SegmentBreakdown: () => <div>MOCK_SEGMENT_BREAKDOWN</div>,
}));

vi.mock("~/components/dashboard/sections/FieldStats", () => ({
  FieldStatsSection: () => <div>MOCK_FIELD_STATS</div>,
}));

vi.mock(
  "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection",
  () => ({
    DeviceBreakdownSection: () => <div>MOCK_DEVICE_BREAKDOWN</div>,
  }),
);

vi.mock("~/components/dashboard/sections/StatsCards", () => ({
  StatsCards: () => <div>MOCK_STATS_CARDS</div>,
}));

vi.mock("~/components/dashboard/sections/Timeline", () => ({
  TimelineSection: () => <div>MOCK_TIMELINE</div>,
}));

vi.mock("~/components/dashboard/sections/UrgentUrls", () => ({
  UrgentUrls: () => <div>MOCK_URGENT_URLS</div>,
}));

vi.mock("~/components/shared/Charts/RatingChart", () => ({
  RatingChart: () => <div>MOCK_RATING_CHART</div>,
}));

vi.mock("~/components/shared/Charts/RatingTrendChart", () => ({
  RatingTrendChart: () => <div>MOCK_RATING_TREND</div>,
}));

vi.mock("~/components/shared/Charts/TopAppsChart", () => ({
  TopAppsChart: () => <div>MOCK_TOP_APPS</div>,
}));

vi.mock("~/components/shared/MarkerModal", () => ({
  MarkerModal: () => null,
}));

vi.mock("~/hooks/useMarkers", () => ({
  useMarkers: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("~/hooks/useSegmentFilter", () => ({
  useSegmentFilter: vi.fn(),
}));

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSegmentFilter = vi.mocked(useSegmentFilter);
const mockUseMarkers = vi.mocked(useMarkers);

function givenSearchParams(params: Record<string, string | undefined>) {
  mockUseSearchParams.mockReturnValue({
    params,
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSegmentFilter.mockReturnValue({
    addSegment: vi.fn(),
  } as never);
  mockUseMarkers.mockReturnValue({
    markers: [],
    isLoading: false,
    isFetching: false,
    error: null,
    createMarker: vi.fn(),
    createMarkerAsync: vi.fn(),
    isCreating: false,
    updateMarker: vi.fn(),
    updateMarkerAsync: vi.fn(),
    isUpdating: false,
    deleteMarker: vi.fn(),
    deleteMarkerAsync: vi.fn(),
    isDeleting: false,
  } as never);
});

describe("RatingDashboard", () => {
  it("shows trend when a rating survey is selected", () => {
    givenSearchParams({ surveyId: "rating-survey-1" });

    render(<RatingDashboard hasSurveyFilter isRatingSurvey />);

    expect(screen.getByText("MOCK_RATING_TREND")).toBeInTheDocument();
  });

  it("hides trend when no survey is selected", () => {
    givenSearchParams({});

    render(<RatingDashboard hasSurveyFilter={false} isRatingSurvey={false} />);

    expect(screen.queryByText("MOCK_RATING_TREND")).not.toBeInTheDocument();
  });

  it("hides trend when selected survey is not rating", () => {
    givenSearchParams({ surveyId: "custom-survey-1" });

    render(<RatingDashboard hasSurveyFilter isRatingSurvey={false} />);

    expect(screen.queryByText("MOCK_RATING_TREND")).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting marker from list", async () => {
    const user = userEvent.setup();
    const deleteMarkerAsync = vi.fn().mockResolvedValue(undefined);

    givenSearchParams({ surveyId: "rating-survey-1" });
    mockUseMarkers.mockReturnValue({
      markers: [
        {
          id: "marker-1",
          team: "team-test",
          surveyId: "rating-survey-1",
          markerDate: "2026-02-01",
          label: "Lansering",
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      createMarker: vi.fn(),
      createMarkerAsync: vi.fn(),
      isCreating: false,
      updateMarker: vi.fn(),
      updateMarkerAsync: vi.fn(),
      isUpdating: false,
      deleteMarker: vi.fn(),
      deleteMarkerAsync,
      isDeleting: false,
    } as never);

    render(<RatingDashboard hasSurveyFilter isRatingSurvey />);

    const deleteButton = screen.getByRole("button", { name: "Slett" });
    await user.click(deleteButton);
    expect(deleteMarkerAsync).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole("button", { name: "Bekreft slett" });
    await user.click(confirmButton);
    expect(deleteMarkerAsync).toHaveBeenCalledWith("marker-1");
  });

  it("shows delete loading state only for the marker being deleted", async () => {
    const user = userEvent.setup();

    givenSearchParams({ surveyId: "rating-survey-1" });
    mockUseMarkers.mockReturnValue({
      markers: [
        {
          id: "marker-1",
          team: "team-test",
          surveyId: "rating-survey-1",
          markerDate: "2026-02-01",
          label: "Lansering",
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "marker-2",
          team: "team-test",
          surveyId: "rating-survey-1",
          markerDate: "2026-02-02",
          label: "Justering",
          createdAt: "2026-02-02T10:00:00Z",
          updatedAt: "2026-02-02T10:00:00Z",
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      createMarker: vi.fn(),
      createMarkerAsync: vi.fn(),
      isCreating: false,
      updateMarker: vi.fn(),
      updateMarkerAsync: vi.fn(),
      isUpdating: false,
      deleteMarker: vi.fn(),
      deleteMarkerAsync: vi.fn(),
      isDeleting: true,
    } as never);

    render(<RatingDashboard hasSurveyFilter isRatingSurvey />);

    const [firstDeleteButton] = screen.getAllByRole("button", {
      name: "Slett",
    });
    await user.click(firstDeleteButton);

    const confirmDeleteButton = screen.getByRole("button", {
      name: /Bekreft slett/,
    });
    expect(confirmDeleteButton).toBeDisabled();

    const unaffectedDeleteButton = screen.getByRole("button", {
      name: "Slett",
    });
    expect(unaffectedDeleteButton).toBeEnabled();
  });
});
