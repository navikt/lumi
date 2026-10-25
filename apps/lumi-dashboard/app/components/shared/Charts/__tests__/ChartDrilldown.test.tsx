import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CSSProperties, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { questionTrendRatingMetric } from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import type { QuestionTrendResponse } from "~/types/api";
import {
  buildTimeAxis,
  type SeriesWindow,
  type TimeInterval,
} from "~/utils/timeBuckets";
import {
  RatingTrendChart,
  type RatingTrendState,
  ratingSeries,
  useRatingSeries,
} from "../RatingTrendChart";
import { countSeries, TimelineChart, useCountSeries } from "../TimelineChart";

const { mockNavigate, mockStats, mockParams, mockTrend, trendCalls, tooltip } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    trendCalls: [] as unknown[][],
    tooltip: { props: undefined as Record<string, unknown> | undefined },
    mockStats: { data: undefined as unknown, isPlaceholderData: false },
    mockParams: {
      surveyId: "survey-historisk",
      dateMode: "auto" as "auto" | "fixed",
      page: "7",
      fromDate: undefined as string | undefined,
      toDate: undefined as string | undefined,
    },
    mockTrend: {
      interval: "day",
      buckets: [
        {
          startDate: "2024-02-18",
          masked: false,
          responseCount: 4,
          average: 2.5,
          distribution: {},
        },
      ] as Array<Record<string, unknown>>,
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
  useQuestionTrend: (...args: unknown[]) => {
    trendCalls.push(args);
    return {
      isPending: false,
      isError: false,
      data: {
        fieldId: "rating",
        fieldType: "RATING",
        label: "Vurdering",
        interval: mockTrend.interval,
        ratingVariant: "emoji",
        ratingScale: 5,
        options: [],
        buckets: mockTrend.buckets,
      },
    };
  },
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

// Each chart is a button that clicks its first point, with buttons that
// point at the first and the second point. Its parts render in an svg.
interface ChartMockProps {
  onClick: (state: { activeIndex: number }) => void;
  onMouseMove: (state: { activeIndex: number }) => void;
  style?: CSSProperties;
  children?: ReactNode;
}

function chartMock(name: string) {
  return ({ onClick, onMouseMove, style, children }: ChartMockProps) => (
    <>
      <svg aria-hidden>{children}</svg>
      <button
        type="button"
        style={style}
        onClick={() => onClick({ activeIndex: 0 })}
      >
        {name}
      </button>
      <button type="button" onClick={() => onMouseMove({ activeIndex: 0 })}>
        Pek på første punkt
      </button>
      <button type="button" onClick={() => onMouseMove({ activeIndex: 1 })}>
        Pek på andre punkt
      </button>
    </>
  );
}

vi.mock("recharts", () => ({
  BarChart: chartMock("Åpne tidslinjedag"),
  Bar: () => null,
  CartesianGrid: () => null,
  Rectangle: () => null,
  LineChart: chartMock("Åpne vurderingsdag"),
  Line: () => null,
  ReferenceLine: () => null,
  Tooltip: (props: Record<string, unknown>) => {
    tooltip.props = props;
    return null;
  },
  XAxis: () => null,
  YAxis: () => null,
}));

function timeline(
  byDate: Record<string, number>,
  window: SeriesWindow,
  interval: TimeInterval = "day",
) {
  return countSeries(buildTimeAxis(window, interval), byDate);
}

function ratingTrend(
  buckets: Array<Record<string, unknown>>,
  window: SeriesWindow,
  interval: TimeInterval = "day",
): RatingTrendState {
  const trend = {
    fieldId: "rating",
    fieldType: "RATING",
    label: "Vurdering",
    interval,
    ratingVariant: "emoji",
    ratingScale: 5,
    options: [],
    buckets,
  } as unknown as QuestionTrendResponse;
  return {
    status: "ready",
    series: ratingSeries(buildTimeAxis(window, interval), trend, []),
    metric: questionTrendRatingMetric(trend),
    overallAverage: undefined,
    overallFormatted: undefined,
  };
}

function RatingTrendFromHooks({ enabled = true }: { enabled?: boolean }) {
  return <RatingTrendChart trend={useRatingSeries([], enabled)} />;
}

function CountTimelineFromHooks() {
  const { series, isPending } = useCountSeries();
  return <TimelineChart series={series} isPending={isPending} />;
}

describe("chart drilldown", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockStats.data = undefined;
    mockStats.isPlaceholderData = false;
    mockParams.dateMode = "auto";
    mockParams.page = "7";
    mockParams.fromDate = undefined;
    mockParams.toDate = undefined;
    mockTrend.interval = "day";
    mockTrend.buckets = [];
    trendCalls.length = 0;
  });

  it("opens a timeline day as a fixed period on the first feedback page", async () => {
    const user = userEvent.setup();

    render(
      <TimelineChart
        series={timeline(
          { "2024-02-18": 3 },
          { from: "2024-02-18", to: "2024-02-18" },
        )}
      />,
    );
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
    expect(mockNavigate.mock.calls[0]?.[0].search).toHaveProperty(
      "periodPreset",
      undefined,
    );
  });

  it("opens a rating day as a fixed period on the first feedback page", async () => {
    const user = userEvent.setup();

    render(
      <RatingTrendChart
        trend={ratingTrend(
          [
            {
              startDate: "2024-02-18",
              masked: false,
              responseCount: 4,
              average: 2.5,
              distribution: {},
            },
          ],
          { from: "2024-02-18", to: "2024-02-18" },
        )}
      />,
    );
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
      },
    });
    expect(mockNavigate.mock.calls[0]?.[0].search).toHaveProperty(
      "lowRating",
      undefined,
    );
  });

  it("opens a whole week of a long period, clipped to the period", async () => {
    const user = userEvent.setup();

    render(
      <TimelineChart
        series={timeline(
          { "2024-01-03": 2, "2024-01-05": 1 },
          { from: "2024-01-03", to: "2024-05-01" },
          "week",
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Åpne tidslinjedag" }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/feedback",
      search: expect.objectContaining({
        dateMode: "fixed",
        page: "1",
        fromDate: "2024-01-03",
        toDate: "2024-01-07",
      }),
    });
  });

  it("opens a whole rating week of a long period, clipped to the period", async () => {
    const user = userEvent.setup();

    render(
      <RatingTrendChart
        trend={ratingTrend(
          [
            {
              startDate: "2024-01-01",
              masked: false,
              responseCount: 6,
              average: 3,
              distribution: {},
            },
          ],
          { from: "2024-01-03", to: "2024-05-01" },
          "week",
        )}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Åpne vurderingsdag" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/feedback",
      search: expect.objectContaining({
        fromDate: "2024-01-03",
        toDate: "2024-01-07",
      }),
    });
  });

  it("does not open an empty bar", async () => {
    const user = userEvent.setup();

    render(
      <TimelineChart
        series={timeline(
          { "2024-01-03": 2 },
          { from: "2024-01-01", to: "2024-01-07" },
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Åpne tidslinjedag" }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a skeleton while the numbers load for the first time", () => {
    render(<TimelineChart series={undefined} isPending />);

    expect(
      screen.queryByRole("button", { name: "Åpne tidslinjedag" }),
    ).not.toBeInTheDocument();
  });

  it("does not combine a cached new trend with placeholder statistics from old filters", () => {
    mockStats.data = { fieldStats: [], averageRating: 4.5, byDate: {} };
    mockStats.isPlaceholderData = true;

    render(<RatingTrendFromHooks />);

    expect(
      screen.queryByRole("button", { name: "Åpne vurderingsdag" }),
    ).not.toBeInTheDocument();
  });
  it("shows a hand only over bars with answers", async () => {
    const user = userEvent.setup();

    render(
      <TimelineChart
        series={timeline(
          { "2024-01-01": 2 },
          { from: "2024-01-01", to: "2024-01-02" },
        )}
      />,
    );
    const chart = screen.getByRole("button", { name: "Åpne tidslinjedag" });

    expect(chart).toHaveStyle({ cursor: "default" });
    await user.click(
      screen.getByRole("button", { name: "Pek på første punkt" }),
    );
    expect(chart).toHaveStyle({ cursor: "pointer" });
    await user.click(
      screen.getByRole("button", { name: "Pek på andre punkt" }),
    );
    expect(chart).toHaveStyle({ cursor: "default" });
  });

  it("shows a hand only over rating points with answers", async () => {
    const user = userEvent.setup();

    render(
      <RatingTrendChart
        trend={ratingTrend(
          [
            {
              startDate: "2024-01-01",
              masked: false,
              responseCount: 4,
              average: 4,
              distribution: {},
            },
          ],
          { from: "2024-01-01", to: "2024-01-02" },
        )}
      />,
    );
    const chart = screen.getByRole("button", { name: "Åpne vurderingsdag" });

    await user.click(
      screen.getByRole("button", { name: "Pek på første punkt" }),
    );
    expect(chart).toHaveStyle({ cursor: "pointer" });
    await user.click(
      screen.getByRole("button", { name: "Pek på andre punkt" }),
    );
    expect(chart).toHaveStyle({ cursor: "default" });
  });

  it("keeps the previous numbers in the count chart while new ones load", () => {
    mockStats.data = {
      byDate: { "2024-01-02": 3 },
      period: { fromDate: "2024-01-01", toDate: "2024-01-07", days: 7 },
    };
    mockStats.isPlaceholderData = true;

    render(<CountTimelineFromHooks />);

    expect(
      screen.getByRole("button", { name: "Åpne tidslinjedag" }),
    ).toBeInTheDocument();
  });

  it("fetches no rating trend for a page that does not show the card", () => {
    mockStats.data = {
      byDate: { "2024-01-02": 3 },
      period: { fromDate: "2024-01-01", toDate: "2024-01-07", days: 7 },
      fieldStats: [{ fieldId: "rating", fieldType: "RATING" }],
    };

    render(<RatingTrendFromHooks enabled={false} />);

    expect(trendCalls.at(-1)?.[0]).toBe(false);
  });

  it("lets the rating tooltip name weeks without an average", () => {
    render(
      <RatingTrendChart
        trend={ratingTrend(
          [
            {
              startDate: "2024-02-18",
              masked: false,
              responseCount: 4,
              average: 2.5,
              distribution: {},
            },
          ],
          { from: "2024-02-18", to: "2024-02-20" },
        )}
      />,
    );

    // recharts leaves out points without a value unless told otherwise.
    expect(tooltip.props?.filterNull).toBe(false);
  });
});
