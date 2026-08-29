import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "~/hooks/useSearchParams";
import { useStats } from "~/hooks/useStats";
import type { FeedbackStats } from "~/types/api";
import { FieldTrendSection } from ".";

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: ({ name }: { name: string }) => <div>{name}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock(
  "~/components/shared/Charts/ResponsiveContainerWithInitialSize",
  () => ({
    ResponsiveContainerWithInitialSize: ({
      children,
    }: {
      children: ReactNode;
    }) => <div>{children}</div>,
  }),
);

vi.mock("~/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("~/hooks/useSearchParams", () => ({ useSearchParams: vi.fn() }));
vi.mock("~/hooks/useStats", () => ({ useStats: vi.fn() }));

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseStats = vi.mocked(useStats);
const setParams = vi.fn();

const baseStats: FeedbackStats = {
  totalCount: 10,
  countWithText: 0,
  countWithoutText: 10,
  byRating: {},
  byApp: {},
  byDate: {},
  bySurveyId: {},
  averageRating: null,
  ratingByDate: {},
  byDevice: {},
  byScreenResolution: {},
  byPathname: {},
  lowestRatingPaths: {},
  fieldStats: [
    {
      fieldId: "identified",
      fieldType: "SINGLE_CHOICE",
      label: "Ble behovet identifisert?",
      stats: {
        type: "choice",
        distribution: {
          yes: { label: "Ja", count: 6, percentage: 60 },
          no: { label: "Nei", count: 4, percentage: 40 },
        },
      },
    },
  ],
  fieldTrend: {
    fieldId: "identified",
    granularity: "week",
    points: [
      {
        periodStart: "2026-08-03",
        responseCount: 10,
        average: null,
        distribution: { yes: 6, no: 4 },
        masked: false,
      },
    ],
  },
  period: { fromDate: "2026-08-01", toDate: "2026-08-31", days: 31 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({
    params: {
      surveyId: "survey-1",
      trendFieldId: "identified",
      trendGranularity: "week",
      trendMeasure: "percentage",
    },
    setParam: vi.fn(),
    setParams,
    resetParams: vi.fn(),
  } as never);
  mockUseStats.mockReturnValue({
    data: baseStats,
    isFetching: false,
    isPlaceholderData: false,
  } as never);
});

describe("FieldTrendSection", () => {
  it("shows a selected choice field as chart and accessible table", async () => {
    const user = userEvent.setup();
    render(<FieldTrendSection />);

    expect(
      screen.getByRole("heading", { name: "Utvikling per spørsmål" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Spørsmål" })).toHaveValue(
      "identified",
    );
    expect(screen.getAllByText("Ja").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nei").length).toBeGreaterThan(0);
    expect(screen.getByText("60 %")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Antall" }));
    expect(setParams).toHaveBeenCalledWith({ trendMeasure: "count" });
  });

  it("writes deterministic defaults to the shareable URL", async () => {
    mockUseSearchParams.mockReturnValue({
      params: { surveyId: "survey-1" },
      setParam: vi.fn(),
      setParams,
      resetParams: vi.fn(),
    } as never);

    render(<FieldTrendSection />);

    await waitFor(() =>
      expect(setParams).toHaveBeenCalledWith({
        trendFieldId: "identified",
        trendGranularity: "week",
        trendMeasure: "percentage",
      }),
    );
  });

  it("explains intervals hidden by the privacy threshold", () => {
    mockUseStats.mockReturnValue({
      data: {
        ...baseStats,
        fieldTrend: {
          fieldId: "identified",
          granularity: "week",
          points: [
            {
              periodStart: "2026-08-03",
              responseCount: null,
              average: null,
              distribution: {},
              masked: true,
            },
          ],
        },
      },
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    expect(
      screen.getByText(
        "Det er for få svar i hvert tidsintervall til å vise utviklingen.",
      ),
    ).toBeInTheDocument();
  });

  it("does not duplicate the established trend for standard rating surveys", () => {
    mockUseStats.mockReturnValue({
      data: {
        ...baseStats,
        fieldStats: [
          {
            fieldId: "rating",
            fieldType: "RATING",
            label: "Hvordan var opplevelsen?",
            stats: {
              type: "rating",
              average: 4,
              distribution: { "1": 0, "2": 0, "3": 1, "4": 5, "5": 4 },
            },
          },
        ],
      },
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection excludeRatingFields />);

    expect(
      screen.queryByRole("heading", { name: "Utvikling per spørsmål" }),
    ).not.toBeInTheDocument();
  });
});
