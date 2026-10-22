import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDiscoveryStats } from "~/hooks/useDiscoveryStats";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { DiscoveryDashboard } from "../Dashboard";

vi.mock("~/components/dashboard/SegmentBreakdown", () => ({
  SegmentBreakdown: () => <div>MOCK_SEGMENT_BREAKDOWN</div>,
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
  TimelineSection: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

vi.mock("../index", () => ({
  DiscoveryAnalysis: () => <div>MOCK_DISCOVERY_ANALYSIS</div>,
}));

vi.mock("../Skeleton", () => ({
  Skeleton: () => <div>MOCK_SKELETON</div>,
}));

vi.mock("~/hooks/useDiscoveryStats", () => ({
  useDiscoveryStats: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("~/hooks/useSegmentFilter", () => ({
  useSegmentFilter: vi.fn(),
}));

const mockUseDiscoveryStats = vi.mocked(useDiscoveryStats);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSegmentFilter = vi.mocked(useSegmentFilter);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({
    params: { surveyId: "survey-discovery" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  } as never);
  mockUseSegmentFilter.mockReturnValue({ addSegment: vi.fn() } as never);
});

describe("DiscoveryDashboard", () => {
  it("shows the analysis between the timeline and the segments", () => {
    mockUseDiscoveryStats.mockReturnValue({
      data: { totalSubmissions: 3 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<DiscoveryDashboard />);

    expect(screen.getByText("MOCK_DISCOVERY_ANALYSIS")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the sections with their own data when the analysis fails", () => {
    mockUseDiscoveryStats.mockReturnValue({
      data: undefined,
      error: new Error("network failure"),
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<DiscoveryDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kunne ikke hente Discovery-data",
    );
    expect(
      screen.queryByText("MOCK_DISCOVERY_ANALYSIS"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_STATS_CARDS")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Antall svar over tid" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });
  it("shows the skeleton for the analysis and the other sections while it loads", () => {
    mockUseDiscoveryStats.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as never);

    render(<DiscoveryDashboard />);

    expect(screen.getByText("MOCK_SKELETON")).toBeInTheDocument();
    expect(
      screen.queryByText("MOCK_DISCOVERY_ANALYSIS"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });
});
