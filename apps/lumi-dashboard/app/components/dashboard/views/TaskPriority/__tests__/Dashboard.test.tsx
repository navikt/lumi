import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTaskPriorityStats } from "~/hooks/useTaskPriorityStats";
import { TaskPriorityDashboard } from "../Dashboard";

vi.mock("~/components/dashboard/SegmentBreakdown", () => ({
  SegmentBreakdown: () => <div>MOCK_SEGMENT_BREAKDOWN</div>,
}));

vi.mock(
  "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection",
  () => ({
    DeviceBreakdownSection: () => <div>MOCK_DEVICE_BREAKDOWN</div>,
  }),
);

vi.mock("~/components/dashboard/sections/Timeline", () => ({
  TimelineSection: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

vi.mock("../index", () => ({
  TaskPriorityAnalysis: () => <div>MOCK_TASK_PRIORITY_ANALYSIS</div>,
}));

vi.mock("../Skeleton", () => ({
  Skeleton: () => <div>MOCK_SKELETON</div>,
}));

vi.mock("~/hooks/useTaskPriorityStats", () => ({
  useTaskPriorityStats: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("~/hooks/useSegmentFilter", () => ({
  useSegmentFilter: vi.fn(),
}));

const mockUseTaskPriorityStats = vi.mocked(useTaskPriorityStats);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSegmentFilter = vi.mocked(useSegmentFilter);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({
    params: { surveyId: "survey-task-priority" },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  } as never);
  mockUseSegmentFilter.mockReturnValue({ addSegment: vi.fn() } as never);
  mockUseTaskPriorityStats.mockReturnValue({
    data: { totalSubmissions: 3, tasks: [] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as never);
});

describe("TaskPriorityDashboard", () => {
  it("names the timeline after what it counts: answers, not votes", () => {
    render(<TaskPriorityDashboard />);

    expect(
      screen.getByRole("heading", { name: "Antall svar over tid" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Stemmer over tid")).not.toBeInTheDocument();
  });
});
