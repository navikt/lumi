import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ElementType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { questionTrendRatingMetric } from "~/components/dashboard/sections/QuestionTrend/questionTrendUtils";
import {
  successRateSeries,
  TopTasksTimelineTable,
} from "~/components/dashboard/views/TopTasks/TimelineChart";
import type { QuestionTrendResponse, RatingMarker } from "~/types/api";
import { buildTimeAxis, type SeriesWindow } from "~/utils/timeBuckets";
import {
  RatingTrendChartTable,
  type RatingTrendState,
  ratingSeries,
} from "../RatingTrendChart";
import { countSeries, TimelineChartTable } from "../TimelineChart";
import { TopAppsChartTable } from "../TopAppsChart";

const { mockStats, mockParams } = vi.hoisted(() => ({
  mockParams: { surveyId: "survey-1" } as Record<string, string | undefined>,
  mockStats: {
    data: undefined as unknown,
    isPending: false,
    isPlaceholderData: false,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  createLink:
    (Component: ElementType) =>
    ({ to, search, ...rest }: { to: string; search?: object }) => (
      <Component
        href={`${to}?${new URLSearchParams(
          Object.entries(search ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )}`}
        {...rest}
      />
    ),
}));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({ ...mockStats }),
}));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params: mockParams }),
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

const LINK_SUFFIX = " – åpne svarene";

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
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        // The links end with text for screen readers only.
        cell.textContent?.replace(LINK_SUFFIX, ""),
      ),
    );
}

describe("chart tables", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParams)) delete mockParams[key];
    mockParams.surveyId = "survey-1";
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
        <TopTasksTimelineTable
          series={successRateSeries(buildTimeAxis(DAYS, "day"), {})}
        />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links each day with answers to Tilbakemeldinger", async () => {
    render(<TimelineChartTable series={days({ "2024-02-19": 4 })} />);
    await openTable();

    const table = screen.getByRole("table", {
      name: "Antall tilbakemeldinger per dag",
    });
    const links = within(table).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(`19.02.2024${LINK_SUFFIX}`);
    const href = new URL(links[0]?.getAttribute("href") ?? "", "http://x");
    expect(href.pathname).toBe("/feedback");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      surveyId: "survey-1",
      dateMode: "fixed",
      fromDate: "2024-02-19",
      toDate: "2024-02-19",
      page: "1",
    });
  });

  it("links only the rating days that have an average", async () => {
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
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([`18.02.2024${LINK_SUFFIX}`]);
  });

  it("shows the success rate per week from the summed answers, with links", async () => {
    render(
      <TopTasksTimelineTable
        series={successRateSeries(
          buildTimeAxis({ from: "2026-10-05", to: "2026-10-22" }, "week"),
          {
            "2026-10-05": { total: 1, success: 1 },
            "2026-10-06": { total: 3, success: 0 },
            "2026-10-20": { total: 2, success: 1 },
          },
        )}
      />,
    );
    await openTable();

    const table = screen.getByRole("table", { name: "Suksessrate per uke" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Uke", "Suksessrate", "Fullført", "Svar"]);
    // Week 41 adds up to one success in four answers. Week 42 has none and
    // no row.
    expect(bodyRows(table)).toEqual([
      ["Uke 41, 2026 · 05.10–11.10", "25%", "1", "4"],
      ["Uke 43, 2026 · 19.10–22.10 (4 av 7 dager)", "50%", "1", "2"],
    ]);
    expect(within(table).getAllByRole("link")).toHaveLength(2);
  });

  it("links the success rate without the segment, which its numbers do not filter on", async () => {
    mockParams.segment = "rolle:leder";
    render(
      <TopTasksTimelineTable
        series={successRateSeries(buildTimeAxis(DAYS, "day"), {
          "2024-02-18": { total: 2, success: 1 },
        })}
      />,
    );
    await openTable();

    const href = screen.getByRole("link").getAttribute("href") ?? "";
    expect(new URL(href, "http://x").searchParams.has("segment")).toBe(false);
  });

  it("shows the previous success rate without links while new numbers load", async () => {
    render(
      <TopTasksTimelineTable
        isStale
        series={successRateSeries(buildTimeAxis(DAYS, "day"), {
          "2024-02-18": { total: 2, success: 1 },
        })}
      />,
    );
    await openTable();

    const table = screen.getByRole("table", { name: "Suksessrate per dag" });
    expect(within(table).queryByRole("link")).not.toBeInTheDocument();
    expect(bodyRows(table)).toEqual([["18.02.2024", "50%", "1", "2"]]);
  });
});
