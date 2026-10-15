import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TopTasksResponse } from "~/types/api";
import { TopTasksStatsCards } from "../StatsCards";

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

function givenTopTasks(
  counts: { success: number; partial: number; failure: number }[],
): TopTasksResponse {
  const tasks = counts.map((count, index) => {
    const total = count.success + count.partial + count.failure;
    return {
      taskId: `task-${index}`,
      task: `Oppgave ${index}`,
      totalCount: total,
      successCount: count.success,
      partialCount: count.partial,
      failureCount: count.failure,
      successRate: total > 0 ? count.success / total : 0,
      formattedSuccessRate: "",
      blockerCounts: {},
    };
  });

  return {
    totalSubmissions: tasks.reduce((sum, task) => sum + task.totalCount, 0),
    tasks,
    dailyStats: {},
  };
}

describe("TopTasksStatsCards", () => {
  it("counts both Delvis and Nei in the Ikke fullført card", () => {
    render(
      <TopTasksStatsCards
        data={givenTopTasks([
          { success: 4, partial: 2, failure: 1 },
          { success: 2, partial: 0, failure: 1 },
        ])}
      />,
    );

    expect(screen.getByText("Suksessrate")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Ikke fullført")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(
      screen.getByText("Andel som svarte Delvis eller Nei"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Feilrate")).not.toBeInTheDocument();
  });

  it("shows 0% success and 100% Ikke fullført when nobody answered Ja", () => {
    render(
      <TopTasksStatsCards
        data={givenTopTasks([{ success: 0, partial: 3, failure: 0 }])}
      />,
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows – instead of a rate when there are no answers", () => {
    render(<TopTasksStatsCards data={givenTopTasks([])} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText("–")).toHaveLength(2);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});
