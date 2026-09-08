import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RatingTrendChart } from "../RatingTrendChart";
import { TimelineChart } from "../TimelineChart";

const { mockNavigate, mockStats, mockParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockStats: { data: undefined as unknown, isPlaceholderData: false },
  mockParams: {
    surveyId: "survey-historisk",
    dateMode: "auto" as "auto" | "fixed",
    page: "7",
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({
    data: mockStats.data,
    isPending: false,
    isPlaceholderData: mockStats.isPlaceholderData,
  }),
}));

vi.mock("~/hooks/useQuestionTrend", () => ({
  useQuestionTrend: () => ({
    isPending: false,
    isError: false,
    data: {
      fieldId: "rating",
      fieldType: "RATING",
      label: "Vurdering",
      interval: "day",
      ratingVariant: "emoji",
      ratingScale: 5,
      options: [],
      buckets: [
        {
          startDate: "2024-02-18",
          masked: false,
          responseCount: 4,
          average: 2.5,
          distribution: {},
        },
      ],
    },
  }),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: mockParams }),
}));

vi.mock("~/hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock("~/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock(
  "~/components/shared/Charts/ResponsiveContainerWithInitialSize",
  () => ({
    ResponsiveContainerWithInitialSize: ({
      children,
    }: {
      children: ReactNode;
    }) => <>{children}</>,
  }),
);

vi.mock("recharts", () => ({
  BarChart: ({
    onClick,
  }: {
    onClick: (state: { activeIndex: number }) => void;
  }) => (
    <button type="button" onClick={() => onClick({ activeIndex: 0 })}>
      Åpne tidslinjedag
    </button>
  ),
  Bar: () => null,
  CartesianGrid: () => null,
  LineChart: ({
    onClick,
  }: {
    onClick: (state: { activeIndex: number }) => void;
  }) => (
    <button type="button" onClick={() => onClick({ activeIndex: 0 })}>
      Åpne vurderingsdag
    </button>
  ),
  Line: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("chart drilldown", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockStats.data = undefined;
    mockStats.isPlaceholderData = false;
    mockParams.dateMode = "auto";
    mockParams.page = "7";
  });

  it("opens a timeline day as a fixed period on the first feedback page", async () => {
    const user = userEvent.setup();
    mockStats.data = { byDate: { "2024-02-18": 3 } };

    render(<TimelineChart />);
    await user.click(screen.getByRole("button", { name: "Åpne tidslinjedag" }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/feedback",
      search: {
        surveyId: "survey-historisk",
        dateMode: "fixed",
        page: "1",
        fromDate: "2024-02-18",
        toDate: "2024-02-18",
      },
    });
  });

  it("opens a rating day as a fixed period on the first feedback page", async () => {
    const user = userEvent.setup();
    mockStats.data = {
      fieldStats: [
        {
          fieldId: "rating",
          fieldType: "RATING",
          stats: {
            type: "rating",
            average: 2.5,
            distribution: { "2": 2, "3": 2 },
            ratingVariant: "emoji",
            ratingScale: 5,
          },
        },
      ],
      ratingByDate: {
        "2024-02-18": { average: 2.5, count: 4 },
      },
      averageRating: 2.5,
    };

    render(<RatingTrendChart />);
    await user.click(
      screen.getByRole("button", { name: "Åpne vurderingsdag" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/feedback",
      search: {
        surveyId: "survey-historisk",
        dateMode: "fixed",
        page: "1",
        fromDate: "2024-02-18",
        toDate: "2024-02-18",
        lowRating: undefined,
      },
    });
  });

  it("does not combine a cached new trend with placeholder statistics from old filters", () => {
    mockStats.data = { fieldStats: [], averageRating: 4.5 };
    mockStats.isPlaceholderData = true;
    render(<RatingTrendChart />);
    expect(
      screen.queryByRole("button", { name: "Åpne vurderingsdag" }),
    ).not.toBeInTheDocument();
  });
});
