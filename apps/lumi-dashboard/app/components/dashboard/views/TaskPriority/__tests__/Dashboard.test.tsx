import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTaskPriorityStats } from "~/hooks/useTaskPriorityStats";
import { analysisBudgetError } from "~/mock/analysisBudget";
import {
  ANALYSIS_BUDGET_TITLE,
  describeAnalysisBudget,
} from "~/utils/analysisBudget";
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

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => undefined,
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
  it("keeps the sections with their own data when the analysis fails", () => {
    mockUseTaskPriorityStats.mockReturnValue({
      data: undefined,
      error: new Error("network failure"),
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TaskPriorityDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kunne ikke hente Task Priority-data",
    );
    expect(
      screen.queryByText("MOCK_TASK_PRIORITY_ANALYSIS"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Antall svar over tid" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });
  it("names the analysis the period has too many answers for", () => {
    mockUseTaskPriorityStats.mockReturnValue({
      data: undefined,
      error: analysisBudgetError(),
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TaskPriorityDashboard />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(
      describeAnalysisBudget("Task Priority-analysen"),
    );
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });
  it("shows the skeleton for the analysis and the other sections while it loads", () => {
    mockUseTaskPriorityStats.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as never);

    render(<TaskPriorityDashboard />);

    expect(screen.getByText("MOCK_SKELETON")).toBeInTheDocument();
    expect(
      screen.queryByText("MOCK_TASK_PRIORITY_ANALYSIS"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });
});
