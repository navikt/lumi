import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode, SVGProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionTrendChart } from "~/components/dashboard/sections/QuestionTrend/QuestionTrendChart";
import type { QuestionTrendResponse } from "~/types/api";
import { RatingTrendChart, RatingTrendPartialNote } from "../RatingTrendChart";
import { TimelinePartialNote } from "../TimelineChart";

const { mockStats, mockParams, mockTrend, chart } = vi.hoisted(() => ({
  mockStats: { data: undefined as unknown },
  mockParams: {} as Record<string, string>,
  mockTrend: { data: undefined as unknown },
  chart: { data: [] as Array<Record<string, unknown>> },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({
    data: mockStats.data,
    isPending: false,
    isPlaceholderData: false,
  }),
}));

vi.mock("~/hooks/useQuestionTrend", () => ({
  useQuestionTrend: () => ({
    isPending: false,
    isError: false,
    data: mockTrend.data,
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

// The line charts draw one dot per point. The mock calls the dot renderer
// for every point, without a y position where the point has no value.
vi.mock("recharts", () => {
  const Empty = () => null;
  const valueAt = (point: Record<string, unknown>, key: string) =>
    key
      .split(".")
      .reduce<unknown>(
        (value, part) => (value as Record<string, unknown> | undefined)?.[part],
        point,
      );

  return {
    LineChart: ({
      data,
      children,
      role,
      "aria-label": ariaLabel,
    }: SVGProps<SVGSVGElement> & { data: Array<Record<string, unknown>> }) => {
      chart.data = data;
      return (
        <svg role={role} aria-label={ariaLabel}>
          {children}
        </svg>
      );
    },
    Line: ({
      dataKey,
      dot,
    }: {
      dataKey: string;
      dot: (props: {
        cx?: number;
        cy?: number;
        index: number;
        payload: Record<string, unknown>;
      }) => ReactElement;
    }) => (
      <g data-series={dataKey}>
        {chart.data.map((payload, index) =>
          dot({
            cx: index * 10,
            cy: valueAt(payload, dataKey) == null ? undefined : 10,
            index,
            payload,
          }),
        )}
      </g>
    ),
    CartesianGrid: Empty,
    Legend: Empty,
    ReferenceLine: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

const ratingStats = {
  fieldStats: [
    {
      fieldId: "rating",
      fieldType: "RATING",
      stats: {
        type: "rating",
        average: 3.8,
        distribution: { "3": 2, "4": 3 },
        ratingVariant: "emoji",
        ratingScale: 5,
      },
    },
  ],
};

function ratingTrend(
  buckets: Array<{ startDate: string; average: number }>,
): QuestionTrendResponse {
  return {
    fieldId: "rating",
    fieldType: "RATING",
    label: "Vurdering",
    interval: "week",
    privacyThreshold: 5,
    ratingVariant: "emoji",
    ratingScale: 5,
    options: [],
    buckets: buckets.map((bucket) => ({
      ...bucket,
      masked: false,
      responseCount: 5,
      distribution: {},
    })),
  } as unknown as QuestionTrendResponse;
}

function hollowDots(container: HTMLElement) {
  return container.querySelectorAll('circle[fill="var(--ax-bg-raised)"]');
}

describe("partial weeks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
    // Wednesday to Wednesday, so the first and the last week are partial.
    mockParams.fromDate = "2026-06-03";
    mockParams.toDate = "2026-10-21";
    mockStats.data = undefined;
    mockTrend.data = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the partial weeks with answers under the count chart", () => {
    mockStats.data = {
      byDate: { "2026-06-04": 2, "2026-08-12": 1, "2026-10-20": 3 },
    };

    render(<TimelinePartialNote />);

    expect(
      screen.getByText(
        "Uke 23 og uke 43 er bare delvis med i perioden og har lysere søyle med stiplet kant.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing when the partial weeks have no answers", () => {
    mockStats.data = { byDate: { "2026-08-12": 1 } };

    const { container } = render(<TimelinePartialNote />);

    expect(container).toBeEmptyDOMElement();
  });

  it("draws a hollow dot for a partial week in the rating chart and names it", () => {
    mockStats.data = ratingStats;
    mockTrend.data = ratingTrend([
      { startDate: "2026-10-12", average: 3.5 },
      { startDate: "2026-10-19", average: 4 },
    ]);

    const { container } = render(
      <>
        <RatingTrendChart />
        <RatingTrendPartialNote />
      </>,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(hollowDots(container)).toHaveLength(1);
    expect(
      screen.getByText(
        "Uke 43 er bare delvis med i perioden og har hul prikk.",
      ),
    ).toBeInTheDocument();
  });

  it("draws hollow dots for partial weeks in the question trend", () => {
    const trend = {
      fieldId: "choice-1",
      fieldType: "SINGLE_CHOICE",
      label: "Hva var viktig?",
      interval: "week",
      privacyThreshold: 5,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      buckets: [],
    } as unknown as QuestionTrendResponse;
    const buckets = ["2025-12-29", "2026-01-05"].map((startDate) => ({
      startDate,
      masked: false,
      responseCount: 4,
      distribution: {
        a: { count: 1, percentage: 25 },
        b: { count: 3, percentage: 75 },
      },
    }));

    const { container } = render(
      <QuestionTrendChart
        trend={trend}
        buckets={buckets}
        measure="percentage"
        isPartial={(startDate) => startDate === "2025-12-29"}
      />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(4);
    expect(hollowDots(container)).toHaveLength(2);
  });
});
