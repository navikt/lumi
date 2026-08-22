import { render, screen } from "@testing-library/react";
import type { ReactNode, SVGProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SurveyTypeDistribution } from "../SurveyTypeDistribution";
import { TaskQuadrantChart } from "../TaskQuadrantChart";

const { surveyTypeDistribution, topTasksStats } = vi.hoisted(() => ({
  surveyTypeDistribution: {
    data: {
      totalSurveys: 3,
      distribution: [
        { type: "rating", count: 2, percentage: 67 },
        { type: "topTasks", count: 1, percentage: 33 },
      ],
    },
    isPending: false,
  },
  topTasksStats: {
    data: {
      tasks: [
        {
          taskId: "task-1",
          task: "Søke om sykepenger",
          totalCount: 80,
          successRate: 0.75,
        },
        {
          taskId: "task-2",
          task: "Finne vedtak",
          totalCount: 40,
          successRate: 0.6,
        },
      ],
    },
    isPending: false,
  },
}));

vi.mock("~/hooks/useSurveyTypeDistribution", () => ({
  useSurveyTypeDistribution: () => surveyTypeDistribution,
}));

vi.mock("~/hooks/useTopTasksStats", () => ({
  useTopTasksStats: () => topTasksStats,
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

vi.mock("recharts", () => {
  const Chart = ({
    children,
    role,
    "aria-label": ariaLabel,
    ...props
  }: SVGProps<SVGSVGElement>) => (
    <svg {...props} role={role} aria-label={ariaLabel}>
      {children}
    </svg>
  );
  const Empty = () => null;

  return {
    Bar: Empty,
    BarChart: Chart,
    CartesianGrid: Empty,
    Rectangle: Empty,
    ReferenceArea: Empty,
    ReferenceLine: Empty,
    Scatter: Empty,
    ScatterChart: Chart,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
    ZAxis: Empty,
  };
});

describe("chart text alternatives", () => {
  it("summarizes the survey type distribution", () => {
    render(<SurveyTypeDistribution />);

    expect(
      screen.getByRole("img", {
        name: "Søylediagram som viser antall surveys per type: Vurdering 2, Top Tasks 1",
      }),
    ).toBeInTheDocument();
  });

  it("names the task quadrant and points to the equivalent table", () => {
    render(<TaskQuadrantChart />);

    expect(
      screen.getByRole("img", {
        name: "Punktdiagram som viser volum og suksessrate for 2 oppgaver. Samme data vises i tabellen.",
      }),
    ).toBeInTheDocument();
  });
});
