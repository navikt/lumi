import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchParams } from "~/hooks/useSearchParams";
import type { FeedbackStats } from "~/hooks/useStats";
import { useStats } from "~/hooks/useStats";
import { StatsCards } from "../index";

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
});

describe("StatsCards", () => {
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

    expect(screen.getByText("Vurdering")).toBeInTheDocument();
    expect(screen.getByText("Ingen rating")).toBeInTheDocument();

    expect(screen.getByText("Tekstsvar")).toBeInTheDocument();
  });
});
