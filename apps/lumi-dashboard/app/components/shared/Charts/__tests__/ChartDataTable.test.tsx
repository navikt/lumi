import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RatingMarker } from "~/types/api";
import { RatingTrendChartTable } from "../RatingTrendChart";
import { TimelineChartTable } from "../TimelineChart";
import { TopAppsChartTable } from "../TopAppsChart";

const { mockStats } = vi.hoisted(() => ({
  mockStats: { data: undefined as unknown, isPending: false },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("~/hooks/useStats", () => ({
  useStats: () => ({
    data: mockStats.data,
    isPending: mockStats.isPending,
    isPlaceholderData: false,
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
  useSearchParams: () => ({ params: {} }),
}));

async function openTable() {
  const toggle = screen.getByRole("button", { name: "Vis som tabell" });
  // Aksel hides the closed content with CSS, which jsdom does not load.
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.setup().click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
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
  });

  it("shows the timeline per day when the viewer opens the table", async () => {
    mockStats.data = { byDate: { "2024-02-19": 1200, "2024-02-18": 3 } };

    render(<TimelineChartTable />);
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
      screen.getByRole("table", { name: "Antall tilbakemeldinger per app" }),
    );
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual(["app-11", "12"]);
    expect(rows[9]).toEqual(["app-2", "3"]);
  });

  it("shows the rating per day and the markers", async () => {
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
    };
    const markers = [
      {
        id: "release",
        team: "team-test",
        surveyId: "survey-1",
        markerDate: "2024-02-20",
        label: "Ny versjon",
        createdAt: "2024-02-20T10:00:00Z",
        updatedAt: "2024-02-20T10:00:00Z",
      },
    ] satisfies RatingMarker[];

    render(<RatingTrendChartTable markers={markers} />);
    await openTable();

    const table = screen.getByRole("table", { name: "Gjennomsnitt per dag" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Dato", "Gjennomsnitt", "Svar", "Markører"]);
    expect(bodyRows(table)).toEqual([
      ["18.02.2024", "2,5", "4", "–"],
      ["20.02.2024", "–", "0", "Ny versjon"],
    ]);
  });

  it("renders nothing while the data is loading or empty", () => {
    mockStats.isPending = true;
    const { container, rerender } = render(<TimelineChartTable />);
    expect(container).toBeEmptyDOMElement();

    mockStats.isPending = false;
    mockStats.data = { byDate: {}, byApp: {} };
    rerender(
      <>
        <TimelineChartTable />
        <TopAppsChartTable />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
