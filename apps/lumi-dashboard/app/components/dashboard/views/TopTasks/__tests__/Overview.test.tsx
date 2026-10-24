import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContextTags } from "~/hooks/useContextTags";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useSegmentFilter } from "~/hooks/useSegmentFilter";
import { useTopTasksStats } from "~/hooks/useTopTasksStats";
import { analysisBudgetError } from "~/mock/analysisBudget";
import type { TopTaskStats, TopTasksResponse } from "~/types/api";
import {
  ANALYSIS_BUDGET_TITLE,
  describeAnalysisBudget,
} from "~/utils/analysisBudget";
import { TopTasksOverview } from "../Overview";

vi.mock("~/components/dashboard", () => ({
  DashboardCard: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const segmentBreakdown = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("~/components/dashboard/SegmentBreakdown", async () => {
  const { useEffect } = await import("react");
  return {
    SegmentBreakdown: () => {
      useEffect(() => {
        segmentBreakdown.mounts += 1;
      }, []);
      return <div>MOCK_SEGMENT_BREAKDOWN</div>;
    },
  };
});

vi.mock(
  "~/components/dashboard/sections/FieldStats/DeviceBreakdownSection",
  () => ({
    DeviceBreakdownSection: () => <div>MOCK_DEVICE_BREAKDOWN</div>,
  }),
);

vi.mock("~/components/dashboard/sections/Timeline", () => ({
  TimelineSection: () => <div>MOCK_TIMELINE</div>,
}));

vi.mock("~/components/dashboard/views/Discovery/BlockerAnalysis", () => ({
  BlockerAnalysis: () => <div>MOCK_BLOCKER_ANALYSIS</div>,
}));

vi.mock("~/components/shared/Charts/TaskQuadrantChart", () => ({
  TaskQuadrantChart: () => <div>MOCK_QUADRANT</div>,
}));

vi.mock("../StatsCards", () => ({
  TopTasksStatsCards: () => <div>MOCK_STATS_CARDS</div>,
}));

vi.mock("../Skeleton", () => ({
  Skeleton: () => <div>MOCK_SKELETON</div>,
}));

vi.mock("~/hooks/useTopTasksStats", () => ({
  useTopTasksStats: vi.fn(),
}));

vi.mock("~/hooks/useContextTags", () => ({ useContextTags: vi.fn() }));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => undefined,
}));

vi.mock("~/hooks/useSegmentFilter", () => ({
  useSegmentFilter: vi.fn(),
}));

const mockUseTopTasksStats = vi.mocked(useTopTasksStats);
const mockUseContextTags = vi.mocked(useContextTags);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseSegmentFilter = vi.mocked(useSegmentFilter);

function givenTask(taskId?: string) {
  mockUseSearchParams.mockReturnValue({
    params: { surveyId: "survey-top-tasks", ...(taskId && { task: taskId }) },
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  } as never);
}

const task: TopTaskStats = {
  taskId: "soke",
  task: "Søke om dagpenger",
  totalCount: 10,
  successCount: 6,
  partialCount: 3,
  failureCount: 1,
  successRate: 0.6,
  formattedSuccessRate: "60%",
  blockerCounts: { "Fant ikke skjemaet": 2 },
};

function givenTopTasks(data: TopTasksResponse) {
  mockUseTopTasksStats.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  segmentBreakdown.mounts = 0;
  mockUseContextTags.mockReturnValue({ error: null } as never);
  givenTask();
  mockUseSegmentFilter.mockReturnValue({ addSegment: vi.fn() } as never);
  givenTopTasks({
    totalSubmissions: 10,
    tasks: [task],
    dailyStats: {},
    questionText: "Hva kom du for å gjøre?",
  });
});

describe("TopTasksOverview", () => {
  it("names the columns after the answer options Ja, Delvis and Nei", () => {
    render(<TopTasksOverview />);

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Oppgave", "Suksessrate", "Svar", "Ja", "Delvis", "Nei"]);

    const [, row] = within(table).getAllByRole("row");
    const cells = within(row).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "Søke om dagpenger",
      "60%",
      "10",
      "6",
      "3",
      "1",
    ]);
  });

  it("renders task rows that cannot be expanded", () => {
    render(<TopTasksOverview />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.queryByText("Årsaker til at oppgaven stoppet"),
    ).not.toBeInTheDocument();
  });

  it("hides the Delvis and Nei header cells the same way as their data cells", () => {
    render(<TopTasksOverview />);

    const table = screen.getByRole("table");
    const [, row] = within(table).getAllByRole("row");
    const [, , totalCell, , partialCell, failureCell] =
      within(row).getAllByRole("cell");
    // Classes that only the hidden data cells have, compared with the
    // visible, right-aligned Svar cell.
    const hideClasses = [...failureCell.classList].filter(
      (name) =>
        partialCell.classList.contains(name) &&
        !totalCell.classList.contains(name),
    );

    expect(hideClasses.length).toBeGreaterThan(0);
    for (const name of ["Delvis", "Nei"]) {
      expect(within(table).getByRole("columnheader", { name })).toHaveClass(
        ...hideClasses,
      );
    }
  });

  it("renders only the header row when there are no tasks", () => {
    givenTopTasks({ totalSubmissions: 0, tasks: [], dailyStats: {} });

    render(<TopTasksOverview />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Spørsmål" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MOCK_BLOCKER_ANALYSIS")).toBeInTheDocument();
  });

  it("keeps the blocker analysis below the table", () => {
    render(<TopTasksOverview />);

    expect(screen.getByText("MOCK_BLOCKER_ANALYSIS")).toBeInTheDocument();
  });
  it("keeps Enheter and Segmentering when the analysis fails", () => {
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: new Error("network failure"),
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kunne ikke hente Top Tasks-data",
    );
    expect(screen.queryByText("MOCK_BLOCKER_ANALYSIS")).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });

  it("shows Segmentering once, with or without a task", () => {
    const { unmount } = render(<TopTasksOverview />);
    expect(screen.getAllByText("MOCK_SEGMENT_BREAKDOWN")).toHaveLength(1);
    unmount();

    givenTask("soke");
    render(<TopTasksOverview />);
    expect(screen.getAllByText("MOCK_SEGMENT_BREAKDOWN")).toHaveLength(1);
  });

  it("shows the skeleton while the analysis loads, and the sections with their own data", () => {
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(screen.getByText("MOCK_SKELETON")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });

  it("names the analysis the period has too many answers for", () => {
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: analysisBudgetError(),
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(ANALYSIS_BUDGET_TITLE);
    expect(alert).toHaveTextContent(
      describeAnalysisBudget("Top Tasks-analysen"),
    );
    expect(
      screen.queryByRole("button", { name: "Prøv igjen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });

  it("keeps the same Segmentering when a task is selected", () => {
    const { rerender } = render(<TopTasksOverview />);

    givenTask("soke");
    rerender(<TopTasksOverview />);

    expect(screen.getAllByText("MOCK_SEGMENT_BREAKDOWN")).toHaveLength(1);
    expect(segmentBreakdown.mounts).toBe(1);
  });

  it("leaves out Segmentering for a task when the API turns both down", () => {
    givenTask("soke");
    mockUseContextTags.mockReturnValue({
      error: analysisBudgetError(),
    } as never);
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: analysisBudgetError(),
      isPending: false,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.queryByText("MOCK_SEGMENT_BREAKDOWN"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_DEVICE_BREAKDOWN")).toBeInTheDocument();
  });

  it("keeps Segmentering for a task when only the analysis is turned down", () => {
    givenTask("soke");
    mockUseContextTags.mockReturnValue({ error: null } as never);
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: analysisBudgetError(),
      isPending: false,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
  });

  it("keeps Segmentering for a task when the analysis fails for another reason", () => {
    givenTask("soke");
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: new Error("network failure"),
      isPending: false,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(screen.getByText("MOCK_SEGMENT_BREAKDOWN")).toBeInTheDocument();
  });

  it("waits with Segmentering for a task until the analysis has answered", () => {
    givenTask("soke");
    mockUseTopTasksStats.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    } as never);

    render(<TopTasksOverview />);

    expect(
      screen.queryByText("MOCK_SEGMENT_BREAKDOWN"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MOCK_SKELETON")).toBeInTheDocument();
  });
});
