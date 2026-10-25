import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveFilters } from "~/components/export/ActiveFilters";
import type { SearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useThemes", () => ({
  useThemes: () => ({ themes: [] }),
}));

const mockUseStats = vi.mocked(useStats);

const topTasksStats = {
  fieldStats: [
    {
      fieldId: "task",
      fieldType: "SINGLE_CHOICE",
      label: "Hva kom du for å gjøre?",
      stats: {
        type: "choice",
        distribution: {
          "lage-oppfolgingsplan": {
            label: "Lage oppfølgingsplan",
            count: 6,
            percentage: 100,
          },
        },
      },
    },
  ],
};

function renderActiveFilters(params: Partial<SearchParams>) {
  return render(<ActiveFilters params={params as SearchParams} />);
}

describe("ActiveFilters", () => {
  beforeEach(() => {
    mockUseStats.mockReturnValue({
      data: topTasksStats,
      isPending: false,
    } as never);
  });

  it("shows the task text instead of the task id", () => {
    renderActiveFilters({ task: "lage-oppfolgingsplan" });

    expect(screen.getByText("Oppgave:")).toBeInTheDocument();
    expect(screen.getByText("Lage oppfølgingsplan")).toBeInTheDocument();
    expect(screen.queryByText("lage-oppfolgingsplan")).not.toBeInTheDocument();
  });

  it("shows the task id when stats have no text for the task", () => {
    renderActiveFilters({ task: "slettet-oppgave" });

    expect(screen.getByText("slettet-oppgave")).toBeInTheDocument();
  });

  it("shows the task id when stats could not be fetched", () => {
    mockUseStats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as never);

    renderActiveFilters({ task: "lage-oppfolgingsplan" });

    expect(screen.getByText("lage-oppfolgingsplan")).toBeInTheDocument();
  });

  it("names the text answer filter like the filter chip", () => {
    renderActiveFilters({ hasText: "true" });

    expect(screen.getByText("Vis kun:")).toBeInTheDocument();
    expect(screen.getByText("Med tekstsvar")).toBeInTheDocument();
  });

  it("names «Fra første svar» with the first answer", () => {
    renderActiveFilters({
      dateMode: "relative",
      periodPreset: "sinceFirst",
      toDate: "2026-10-25",
    });
    expect(screen.getByText(/Fra første svar/)).toHaveTextContent(
      "Periode: Fra første svar",
    );

    render(
      <ActiveFilters
        params={
          {
            dateMode: "relative",
            periodPreset: "sinceFirst",
            toDate: "2026-10-25",
          } as SearchParams
        }
        firstAnswerDate="2025-12-29"
      />,
    );
    expect(
      screen.getByText("Fra første svar (29.12.2025)", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fra:")).not.toBeInTheDocument();
  });
});
