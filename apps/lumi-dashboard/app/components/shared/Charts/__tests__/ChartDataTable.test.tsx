import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { questionTrendRatingMetric } from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import type { QuestionTrendResponse, RatingMarker } from "~/types/api";
import { buildTimeAxis, type SeriesWindow } from "~/utils/timeBuckets";
import {
  RatingTrendChartTable,
  type RatingTrendState,
  ratingSeries,
} from "../RatingTrendChart";
import { countSeries, TimelineChartTable } from "../TimelineChart";
import { TopAppsChartTable } from "../TopAppsChart";

const { mockStats } = vi.hoisted(() => ({
  mockStats: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({ ...mockStats }),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: {} }),
}));

const DAYS: SeriesWindow = { from: "2024-02-18", to: "2024-02-20" };

function days(byDate: Record<string, number>, window: SeriesWindow = DAYS) {
  return countSeries(buildTimeAxis(window, "day"), byDate);
}

function ready(
  trendData: unknown,
  markers: RatingMarker[] = [],
  window: SeriesWindow = DAYS,
): RatingTrendState {
  const trendResponse = trendData as QuestionTrendResponse;
  return {
    status: "ready",
    series: ratingSeries(buildTimeAxis(window, "day"), trendResponse, markers),
    metric: questionTrendRatingMetric(trendResponse),
    overallAverage: undefined,
    overallFormatted: undefined,
  };
}

function trend(
  buckets: unknown[],
  variant: { ratingVariant: string; ratingScale: number } = {
    ratingVariant: "emoji",
    ratingScale: 5,
  },
) {
  return {
    fieldId: "rating",
    fieldType: "RATING",
    label: "Vurdering",
    interval: "day",
    options: [],
    ...variant,
    buckets,
  };
}

const marker = {
  id: "release",
  team: "team-test",
  surveyId: "survey-1",
  markerDate: "2024-02-20",
  label: "Ny versjon",
  createdAt: "2024-02-20T10:00:00Z",
  updatedAt: "2024-02-20T10:00:00Z",
} satisfies RatingMarker;

function toggleButton() {
  return screen.getByRole("button", { name: /^Vis som tabell/ });
}

async function openTable() {
  const toggle = toggleButton();
  // Aksel hides the closed content with CSS, which jsdom does not load, so
  // check the state the CSS keys on instead.
  expect(toggle.closest(".aksel-read-more")).toHaveAttribute(
    "data-state",
    "closed",
  );
  await userEvent.setup().click(toggle);
  expect(toggle.closest(".aksel-read-more")).toHaveAttribute(
    "data-state",
    "open",
  );
}

function bodyRows(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map(
        (cell) => cell.textContent,
      ),
    );
}

describe("chart tables", () => {
  beforeEach(() => {
    mockStats.data = undefined;
    mockStats.isPending = false;
    mockStats.isPlaceholderData = false;
  });

  it("shows the timeline per day when the viewer opens the table", async () => {
    render(
      <TimelineChartTable
        series={days(
          { "2024-02-19": 1200, "2024-02-18": 3 },
          { from: "2024-02-18", to: "2024-02-19" },
        )}
      />,
    );
    expect(toggleButton()).toHaveAccessibleName(
      "Vis som tabell: Antall tilbakemeldinger per dag",
    );
    await openTable();

    const table = screen.getByRole("table", {
      name: "Antall tilbakemeldinger per dag",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Dato", "Tilbakemeldinger"]);
    expect(bodyRows(table)).toEqual([
      ["18.02.2024", "3"],
      ["19.02.2024", "1 200"],
    ]);
    // A narrow card may scroll the table sideways, so the region takes focus.
    expect(
      screen.getByRole("region", { name: "Antall tilbakemeldinger per dag" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("names the timeline table after what the section counts", async () => {
    render(
      <TimelineChartTable series={days({ "2024-02-18": 3 })} noun="svar" />,
    );
    expect(toggleButton()).toHaveAccessibleName(
      "Vis som tabell: Antall svar per dag",
    );
    await openTable();

    const table = screen.getByRole("table", { name: "Antall svar per dag" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Dato", "Svar"]);
  });

  it("lists the ten apps with most feedback, like the chart", async () => {
    mockStats.data = {
      byApp: Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [`app-${index}`, index + 1]),
      ),
    };

    render(<TopAppsChartTable />);
    await openTable();

    const rows = bodyRows(
      screen.getByRole("table", {
        name: "De ti appene med flest tilbakemeldinger",
      }),
    );
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual(["app-11", "12"]);
    expect(rows[9]).toEqual(["app-2", "3"]);
  });

  it("shows the rating per day, hidden days and the markers", async () => {
    render(
      <RatingTrendChartTable
        trend={ready(
          trend([
            {
              startDate: "2024-02-18",
              masked: false,
              responseCount: 4,
              average: 2.5,
              distribution: {},
            },
            {
              startDate: "2024-02-19",
              masked: true,
              responseCount: null,
              average: null,
              distribution: {},
            },
          ]),
          [marker],
        )}
      />,
    );
    await openTable();

    const table = screen.getByRole("table", {
      name: "Gjennomsnittlig vurdering per dag",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Dato", "Gjennomsnitt", "Svar", "Markører"]);
    expect(bodyRows(table)).toEqual([
      ["18.02.2024", "2,5", "4", "–"],
      ["19.02.2024", "Skjult", "Skjult", "–"],
      ["20.02.2024", "–", "0", "Ny versjon"],
    ]);
  });

  it("writes the share of positive thumbs as a percentage", async () => {
    render(
      <RatingTrendChartTable
        trend={ready(
          trend(
            [
              {
                startDate: "2024-02-18",
                masked: false,
                responseCount: 4,
                ratingDistribution: { "1": 1, "2": 3 },
                distribution: {},
              },
            ],
            { ratingVariant: "thumbs", ratingScale: 2 },
          ),
        )}
      />,
    );
    await openTable();

    const [row] = bodyRows(
      screen.getByRole("table", { name: "Andel positive per dag" }),
    );
    expect(row?.[1]).toMatch(/^\d+(,\d)?%$/);
  });

  it("keeps an opened rating table open, under the same name, while new filters load", async () => {
    const shown = ready(
      trend([
        {
          startDate: "2024-02-18",
          masked: false,
          responseCount: 4,
          average: 2.5,
          distribution: {},
        },
      ]),
    );
    const { rerender } = render(<RatingTrendChartTable trend={shown} />);
    await openTable();

    rerender(<RatingTrendChartTable trend={{ status: "pending" }} />);
    expect(screen.getByText("Laster tallene …")).toBeInTheDocument();
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton()).toHaveAccessibleName(
      "Vis som tabell: Gjennomsnittlig vurdering per dag",
    );

    rerender(<RatingTrendChartTable trend={shown} />);
    expect(
      screen.getByRole("table", { name: "Gjennomsnittlig vurdering per dag" }),
    ).toBeInTheDocument();
    expect(toggleButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("renders nothing while the data first loads, fails or is empty", () => {
    const { container, rerender } = render(
      <>
        <TimelineChartTable series={days({})} />
        <RatingTrendChartTable trend={{ status: "pending" }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();

    mockStats.data = { byApp: {} };
    rerender(
      <>
        <TimelineChartTable series={days({})} />
        <TopAppsChartTable />
        <RatingTrendChartTable trend={{ status: "error" }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
