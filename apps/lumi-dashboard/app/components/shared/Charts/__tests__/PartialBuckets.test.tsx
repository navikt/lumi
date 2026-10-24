import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode, SVGProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuestionTrendChart } from "~/components/dashboard/sections/QuestionTrend/QuestionTrendChart";
import {
  questionSeries,
  questionTrendRatingMetric,
} from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import type { QuestionTrendResponse, RatingMarker } from "~/types/api";
import { buildTimeAxis, type SeriesWindow } from "~/utils/timeBuckets";
import {
  RatingTrendChart,
  RatingTrendMarkersOffAxis,
  RatingTrendPartialNote,
  type RatingTrendState,
  ratingSeries,
} from "../RatingTrendChart";
import { countSeries, TimelinePartialNote } from "../TimelineChart";

const { chart } = vi.hoisted(() => ({
  chart: { data: [] as Array<Record<string, unknown>> },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: {} }),
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
// for every point, without a y position where the point has no value, and
// passes the line's colour as recharts does.
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
      stroke,
      dot,
    }: {
      dataKey: string;
      stroke: string;
      dot: (props: {
        cx?: number;
        cy?: number;
        index: number;
        stroke: string;
        payload: Record<string, unknown>;
      }) => ReactElement;
    }) => (
      <g data-series={dataKey}>
        {chart.data.map((payload, index) =>
          dot({
            cx: index * 10,
            cy: valueAt(payload, dataKey) == null ? undefined : 10,
            index,
            stroke,
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

// From a Wednesday to a Wednesday: the first and the last week are partial.
const WINDOW: SeriesWindow = { from: "2026-06-03", to: "2026-10-21" };

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

function ready(
  trend: QuestionTrendResponse,
  markers: RatingMarker[] = [],
): RatingTrendState {
  return {
    status: "ready",
    series: ratingSeries(buildTimeAxis(WINDOW, "week"), trend, markers),
    metric: questionTrendRatingMetric(trend),
    overallAverage: undefined,
    overallFormatted: undefined,
  };
}

function hollowDots(container: HTMLElement) {
  return container.querySelectorAll('circle[fill="var(--ax-bg-raised)"]');
}

describe("partial weeks", () => {
  it("names the partial weeks with bars, and their days, under the count chart", () => {
    render(
      <TimelinePartialNote
        series={countSeries(buildTimeAxis(WINDOW, "week"), {
          "2026-06-04": 2,
          "2026-08-12": 1,
          "2026-10-20": 3,
        })}
      />,
    );

    expect(
      screen.getByText(
        "Bare 5 av 7 dager i uke 23 og 3 av 7 dager i uke 43 er med i grafen. Ukene har lysere søyler med stiplet kant.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing when the partial weeks have no bars", () => {
    const { container } = render(
      <TimelinePartialNote
        series={countSeries(buildTimeAxis(WINDOW, "week"), {
          "2026-08-12": 1,
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("draws a hollow dot for a partial week in the rating chart and names it", () => {
    const trend = ready(
      ratingTrend([
        { startDate: "2026-10-12", average: 3.5 },
        { startDate: "2026-10-19", average: 4 },
      ]),
    );

    const { container } = render(
      <>
        <RatingTrendChart trend={trend} />
        <RatingTrendPartialNote trend={trend} />
      </>,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(hollowDots(container)).toHaveLength(1);
    expect(
      screen.getByText(
        "Bare 3 av 7 dager i uke 43 er med i grafen. Uka har hul prikk.",
      ),
    ).toBeInTheDocument();
  });

  it("says which markers are only in the list", () => {
    const marker = (id: string, markerDate: string): RatingMarker => ({
      id,
      team: "team-test",
      surveyId: "survey-1",
      markerDate,
      label: id,
      createdAt: "2026-05-20T10:00:00Z",
      updatedAt: "2026-05-20T10:00:00Z",
    });
    const trend = ready(
      ratingTrend([{ startDate: "2026-10-12", average: 3 }]),
      [
        marker("before-1", "2026-05-20"),
        marker("before-2", "2026-06-01"),
        marker("later", "2026-11-10"),
      ],
    );

    render(<RatingTrendMarkersOffAxis trend={trend} />);

    expect(
      screen.getByText(
        "2 markører har dato før grafen begynner og står bare i listen Markører. 1 markør har dato etter i dag og står bare i listen Markører.",
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
      buckets: ["2025-12-29", "2026-01-05"].map((startDate) => ({
        startDate,
        masked: false,
        responseCount: 4,
        distribution: {
          a: { count: 1, percentage: 25 },
          b: { count: 3, percentage: 75 },
        },
      })),
    } as unknown as QuestionTrendResponse;
    const series = questionSeries(
      buildTimeAxis({ from: "2026-01-01", to: "2026-01-11" }, "week"),
      trend,
    );

    const { container } = render(
      <QuestionTrendChart
        trend={trend}
        points={series.points}
        measure="percentage"
      />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(4);
    expect(hollowDots(container)).toHaveLength(2);
  });
});
