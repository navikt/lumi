import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestionTrend } from "~/hooks/useQuestionTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import { QuestionTrendSection } from ".";

vi.mock("~/hooks/useQuestionTrend", () => ({ useQuestionTrend: vi.fn() }));
vi.mock("~/hooks/useSearchParams", () => ({ useSearchParams: vi.fn() }));
vi.mock("~/hooks/useStats", () => ({ useStats: vi.fn() }));
vi.mock("./QuestionTrendChart", () => ({
  QuestionTrendChart: () => <div role="img" aria-label="Testdiagram" />,
}));

const mockUseQuestionTrend = vi.mocked(useQuestionTrend);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseStats = vi.mocked(useStats);
const setParams = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({
    params: { surveyId: "survey-1" },
    setParam: vi.fn(),
    setParams,
    resetParams: vi.fn(),
  } as never);
  mockUseStats.mockReturnValue({
    data: {
      fieldStats: [
        {
          fieldId: "text-1",
          fieldType: "TEXT",
          label: "Fritekst",
          stats: {
            type: "text",
            responseCount: 5,
            responseRate: 1,
            topKeywords: [],
            recentResponses: [],
          },
        },
        {
          fieldId: "choice-1",
          fieldType: "MULTI_CHOICE",
          label: "Hva var viktig?",
          stats: { type: "choice", distribution: {} },
        },
      ],
    },
    isPending: false,
  } as never);
  mockUseQuestionTrend.mockReturnValue({
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as never);
});

describe("QuestionTrendSection", () => {
  it("offers only structured fields and stores all choices in the URL", async () => {
    const user = userEvent.setup();
    render(<QuestionTrendSection />);

    const select = screen.getByRole("combobox", { name: "Spørsmål" });
    expect(screen.queryByRole("option", { name: "Fritekst" })).toBeNull();
    await user.selectOptions(select, "choice-1");

    expect(setParams).toHaveBeenCalledWith({
      trendField: "choice-1",
      trendInterval: "week",
      trendMeasure: "percentage",
    });
  });

  it("shows masked periods without exposing values and explains multi-choice percentages", () => {
    mockUseSearchParams.mockReturnValue({
      params: {
        surveyId: "survey-1",
        trendField: "choice-1",
        trendInterval: "month",
        trendMeasure: "percentage",
      },
      setParam: vi.fn(),
      setParams,
      resetParams: vi.fn(),
    } as never);
    mockUseQuestionTrend.mockReturnValue({
      data: {
        fieldId: "choice-1",
        fieldType: "MULTI_CHOICE",
        label: "Hva var viktig?",
        interval: "month",
        privacyThreshold: 5,
        options: [{ id: "a", label: "Alternativ A" }],
        buckets: [
          {
            startDate: "2026-01-01",
            masked: true,
            distribution: {},
          },
          {
            startDate: "2026-02-01",
            masked: false,
            responseCount: 5,
            distribution: { a: { count: 3, percentage: 60 } },
          },
        ],
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    render(<QuestionTrendSection />);

    expect(screen.getByText(/Summen kan være over 100 prosent/)).toBeVisible();
    expect(screen.getAllByText("Skjult").length).toBeGreaterThan(0);
    expect(screen.getByText("60 %")).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
  });
});
