import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RatingTrendChart } from "../RatingTrendChart";
import { TimelineChart } from "../TimelineChart";

const { mockNavigate, mockStats, mockParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockStats: { data: undefined as unknown },
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
  useStats: () => ({ data: mockStats.data, isPending: false }),
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
        lowRating: "true",
      },
    });
  });
});
