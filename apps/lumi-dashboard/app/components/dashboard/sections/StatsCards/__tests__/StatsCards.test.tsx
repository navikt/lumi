import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats } from "~/hooks/useStats";
import { useStats } from "~/hooks/useStats";
import { StatsCards } from "../index";

const { mockAnswerSpan } = vi.hoisted(() => ({
  mockAnswerSpan: {
    value: undefined as { fromDate: string; toDate: string } | undefined,
  },
}));

vi.mock("~/hooks/useAnswerSpan", () => ({
  useAnswerSpan: () => mockAnswerSpan.value,
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: vi.fn(),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

const mockUseStats = vi.mocked(useStats);
const mockUseSearchParams = vi.mocked(useSearchParams);

function givenSearchParams(params: Record<string, string | undefined>) {
  mockUseSearchParams.mockReturnValue({
    params,
    setParam: vi.fn(),
    setParams: vi.fn(),
    resetParams: vi.fn(),
  } as never);
}

function givenStats(stats: Partial<FeedbackStats>) {
  mockUseStats.mockReturnValue({
    data: stats as FeedbackStats,
    isPending: false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswerSpan.value = undefined;
});

describe("StatsCards", () => {
  const sinceFirst = {
    dateMode: "relative",
    periodPreset: "sinceFirst",
    toDate: "2026-10-25",
  };
  // The API counts a period without a start as 30 days.
  const openPeriod = { fromDate: null, toDate: "2026-10-25", days: 30 };

  it("counts «Fra første svar» from the first answer for the selection", () => {
    givenSearchParams(sinceFirst);
    givenStats({ totalCount: 3, countWithText: 1, period: openPeriod });
    mockAnswerSpan.value = { fromDate: "2026-10-01", toDate: "2026-10-24" };

    render(<StatsCards />);

    expect(screen.getByText("25d")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01 → 2026-10-25")).toBeInTheDocument();
    expect(
      screen.getByText("I perioden 01.10.2026–25.10.2026"),
    ).toBeInTheDocument();
    expect(screen.queryByText("30d")).not.toBeInTheDocument();
  });

  it("leaves the days out until the first answer is known", () => {
    givenSearchParams(sinceFirst);
    givenStats({ totalCount: 0, countWithText: 0, period: openPeriod });

    render(<StatsCards />);

    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("– → 2026-10-25")).toBeInTheDocument();
    expect(screen.getByText("I valgt periode")).toBeInTheDocument();
  });

  it("counts a period without a start from the first answer, also from a link", () => {
    givenSearchParams({ dateMode: "fixed", toDate: "2026-10-25" });
    givenStats({ totalCount: 3, countWithText: 1, period: openPeriod });
    mockAnswerSpan.value = { fromDate: "2026-10-01", toDate: "2026-10-24" };

    render(<StatsCards />);

    expect(screen.getByText("25d")).toBeInTheDocument();
  });

  it("writes long periods with a thousands separator", () => {
    givenSearchParams(sinceFirst);
    givenStats({ totalCount: 3, countWithText: 1, period: openPeriod });
    mockAnswerSpan.value = { fromDate: "2023-10-24", toDate: "2026-10-24" };

    render(<StatsCards />);

    // The separator is a no-break space, which the matcher reads as a space.
    expect(screen.getByText("1 098d").textContent).toBe("1\u00a0098d");
  });

  it("keeps the period of the numbers on screen while new ones load", () => {
    const shown = { totalCount: 3, countWithText: 1, period: openPeriod };
    givenSearchParams(sinceFirst);
    givenStats(shown);
    mockAnswerSpan.value = { fromDate: "2026-10-01", toDate: "2026-10-24" };
    const { rerender } = render(<StatsCards />);
    expect(screen.getByText("25d")).toBeInTheDocument();

    // Another app: its first answer is known, its numbers are not yet.
    mockUseStats.mockReturnValue({
      data: shown as FeedbackStats,
      isPending: false,
      isPlaceholderData: true,
    } as never);
    mockAnswerSpan.value = { fromDate: "2026-10-20", toDate: "2026-10-24" };
    rerender(<StatsCards />);

    expect(screen.getByText("25d")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01 → 2026-10-25")).toBeInTheDocument();
  });

  it("describes a historical period with its actual dates", () => {
    givenSearchParams({ surveyId: "survey-1" });
    givenStats({
      totalCount: 12,
      countWithText: 4,
      period: {
        fromDate: "2024-01-05",
        toDate: "2024-03-20",
        days: 76,
      },
      privacy: { masked: false, threshold: 5 },
    });

    render(<StatsCards />);

    expect(
      screen.getByText("I perioden 05.01.2024–20.03.2024"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Siste 76 dager")).not.toBeInTheDocument();
  });

  it("renders detailed survey stats using fieldStats when surveyId is set", () => {
    givenSearchParams({ surveyId: "survey-1" });
    givenStats({
      totalCount: 12,
      countWithText: 4,
      averageRating: 2.0,
      fieldStats: [
        {
          fieldId: "rating-1",
          fieldType: "RATING",
          label: "Hvordan gikk det?",
          stats: {
            type: "rating",
            average: 4.2,
            distribution: { "1": 0, "2": 1, "3": 1, "4": 3, "5": 7 },
          },
        },
        {
          fieldId: "text-1",
          fieldType: "TEXT",
          label: "Kommentar",
          stats: {
            type: "text",
            responseCount: 2,
            responseRate: 0.0,
            topKeywords: [],
            recentResponses: [],
          },
        },
        {
          fieldId: "text-2",
          fieldType: "TEXT",
          label: "Hva kan bli bedre?",
          stats: {
            type: "text",
            responseCount: 5,
            responseRate: 0.0,
            topKeywords: [],
            recentResponses: [],
          },
        },
      ],
      period: {
        fromDate: "2025-01-01",
        toDate: "2025-01-30",
        days: 30,
      },
      privacy: { masked: false, threshold: 5 },
    });

    render(<StatsCards showRating />);

    expect(screen.getByText("Tilbakemeldinger")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByText("Snitt vurdering")).toBeInTheDocument();
    expect(screen.getByText("4.2 😀")).toBeInTheDocument();

    expect(screen.getByText("Tekstsvar")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2 felt")).toBeInTheDocument();
  });

  it("falls back to averageRating and countWithText when fieldStats is missing", () => {
    givenSearchParams({ surveyId: "survey-1" });
    givenStats({
      totalCount: 10,
      countWithText: 4,
      averageRating: 3.6,
      fieldStats: [],
      period: {
        fromDate: "2025-01-01",
        toDate: "2025-01-30",
        days: 30,
      },
      privacy: { masked: false, threshold: 5 },
    });

    render(<StatsCards showRating />);

    expect(screen.getByText("Snitt vurdering")).toBeInTheDocument();
    expect(screen.getByText("3.6 😀")).toBeInTheDocument();

    expect(screen.getByText("Tekstsvar")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("På tvers av felt")).toBeInTheDocument();
  });

  it("masks sensitive values when privacy.masked is true", () => {
    givenSearchParams({ surveyId: "survey-1" });
    givenStats({
      totalCount: 12,
      countWithText: 4,
      averageRating: 4.2,
      fieldStats: [
        {
          fieldId: "rating-1",
          fieldType: "RATING",
          label: "Hvordan gikk det?",
          stats: {
            type: "rating",
            average: 4.2,
            distribution: { "1": 0, "2": 1, "3": 1, "4": 3, "5": 7 },
          },
        },
      ],
      period: {
        fromDate: "2025-01-01",
        toDate: "2025-01-30",
        days: 30,
      },
      privacy: { masked: true, threshold: 5, reason: "threshold" },
    });

    render(<StatsCards showRating />);

    expect(screen.getByText("Tilbakemeldinger")).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);

    // Rating card now shows "Snitt vurdering" label regardless of state
    expect(screen.getByText("Snitt vurdering")).toBeInTheDocument();
    expect(screen.getByText("Ingen rating")).toBeInTheDocument();

    expect(screen.getByText("Tekstsvar")).toBeInTheDocument();
  });
});
