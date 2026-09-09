import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStatsServerFn } from "~/server/actions";
import type { FeedbackStats, FieldStat } from "~/types/api";
import { TextFieldCard } from "../FieldCards/TextFieldCard";
import { ComparisonStatsCards } from "./ComparisonStatsCards";
import { getRatingMetric, ratingFieldsAreComparable } from "./model";
import { getComparisonPeriods } from "./usePreviousPeriodStats";

vi.mock("~/server/actions", () => ({ fetchStatsServerFn: vi.fn() }));
vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({
    params: {
      team: "esyfo",
      app: "test-app",
      surveyId: "test-survey",
      fromDate: "2026-08-19",
      toDate: "2026-09-01",
      showArchived: "true",
      deviceType: "mobile",
      segment: "role:employee",
      task: "apply",
      rating: "rating:4",
      choice: "role:employee",
    },
  }),
}));
vi.mock("~/hooks/useStats", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/hooks/useStats")>()),
  useStats: () => ({
    data: currentStats,
    isPending: false,
    isPlaceholderData: false,
  }),
}));
vi.mock("~/components/dashboard", () => ({
  DashboardCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  DashboardGrid: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

function stats(totalCount: number, countWithText: number): FeedbackStats {
  return {
    totalCount,
    retentionStartDate: "2025-09-08",
    countWithText,
    countWithoutText: totalCount - countWithText,
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
    fieldStats: [],
    surveyType: "custom",
    period: { fromDate: "2026-08-19", toDate: "2026-09-01", days: 14 },
  };
}

let currentStats = stats(100, 60);

function renderComparison() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ComparisonStatsCards />
    </QueryClientProvider>,
  );
  return client;
}

describe("comparison periods", () => {
  it.each([
    ["2026-08-19", "2026-09-01", "2026-08-05", "2026-08-18"],
    ["2026-01-01", "2026-01-01", "2025-12-31", "2025-12-31"],
    ["2024-03-01", "2024-03-02", "2024-02-28", "2024-02-29"],
    ["2026-03-29", "2026-03-30", "2026-03-27", "2026-03-28"],
  ])("compares inclusive calendar days for %s–%s", (from, to, previousFrom, previousTo) => {
    expect(getComparisonPeriods(from, to)?.previous).toMatchObject({
      fromDate: previousFrom,
      toDate: previousTo,
    });
  });

  it.each([
    [undefined, "2026-09-01"],
    ["2026-02-30", "2026-03-05"],
    ["2026-8-19", "2026-09-01"],
    ["2026-09-02", "2026-09-01"],
    ["invalid", "2026-09-01"],
  ])("rejects missing, normalized or reversed dates: %s–%s", (from, to) => {
    expect(getComparisonPeriods(from, to)).toBeUndefined();
  });
});

describe("comparison data and recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStats = stats(100, 60);
  });

  it("uses the same filters and compares submission counts", async () => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    renderComparison();
    expect(await screen.findByText("+20")).toBeInTheDocument();
    expect(fetchStatsServerFn).toHaveBeenCalledWith({
      data: {
        team: "esyfo",
        app: "test-app",
        surveyId: "test-survey",
        fromDate: "2026-08-05",
        toDate: "2026-08-18",
        includeArchived: "true",
        deviceType: "mobile",
        segment: "role:employee",
        task: "apply",
        rating: ["rating:4"],
        choice: ["role:employee"],
      },
    });
  });

  it("removes cached deltas after a failed refresh and restores them on retry", async () => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    const client = renderComparison();
    await screen.findByText("+20");
    vi.mocked(fetchStatsServerFn).mockRejectedValue(new Error("unavailable"));
    await act(async () => {
      await client.invalidateQueries();
    });
    await screen.findByText(/Perioden før kunne ikke hentes/);
    expect(screen.queryByText("+20")).not.toBeInTheDocument();
    expect(screen.queryByText("Endring")).not.toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    fireEvent.click(
      screen.getByRole("button", { name: "Prøv sammenligningen igjen" }),
    );
    await screen.findByText("+20");
    await waitFor(() =>
      expect(
        screen.queryByText(/Perioden før kunne ikke hentes/),
      ).not.toBeInTheDocument(),
    );
  });

  it("hides all deltas for a privacy-masked previous period", async () => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue({
      ...stats(3, 2),
      privacy: { masked: true, reason: "For få svar", threshold: 5 },
    });
    renderComparison();
    expect(
      await screen.findByText(/Perioden før er skjult av personvernhensyn/),
    ).toHaveTextContent("skjult av personvernhensyn");
    expect(screen.queryByText("Endring")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Prøv sammenligningen igjen" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("does not treat missing comparison responses as a zero baseline", async () => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(0, 0));
    renderComparison();
    expect(
      await screen.findByText(/Ingen svar å sammenligne med/),
    ).toBeInTheDocument();
    expect(screen.queryByText("+100")).not.toBeInTheDocument();
    expect(screen.queryByText("+60 pp")).not.toBeInTheDocument();
  });

  it("does not promote a custom survey rating or text count to a key metric", async () => {
    currentStats.fieldStats = [ratingField];
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    renderComparison();
    expect(screen.getByText("Tilbakemeldinger")).toBeInTheDocument();
    expect(screen.queryByText("Snitt vurdering")).not.toBeInTheDocument();
    expect(screen.queryByText("Andel med tekst")).not.toBeInTheDocument();
    expect(screen.queryByText("Med tekst")).not.toBeInTheDocument();
    expect(screen.queryByText("60 %")).not.toBeInTheDocument();
  });

  it("keeps the single rating survey metric and its period change", async () => {
    currentStats.surveyType = "rating";
    currentStats.fieldStats = [ratingField];
    vi.mocked(fetchStatsServerFn).mockResolvedValue({
      ...stats(80, 40),
      fieldStats: [
        {
          ...ratingField,
          stats: {
            type: "rating",
            ratingVariant: "emoji",
            ratingScale: 5,
            average: 3,
            distribution: { "3": 80 },
          },
        },
      ],
    });
    renderComparison();
    expect(await screen.findByText("+1,0 poeng")).toBeInTheDocument();
    expect(screen.getByText("Snitt vurdering")).toBeInTheDocument();
  });

  it("does not choose an arbitrary primary metric from multiple rating fields", () => {
    currentStats.surveyType = "rating";
    currentStats.fieldStats = [
      ratingField,
      { ...ratingField, fieldId: "second" },
    ];
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    renderComparison();
    expect(screen.queryByText("Snitt vurdering")).not.toBeInTheDocument();
  });

  it.each([
    [undefined, "Historikken for sammenligningen kunne ikke bekreftes"],
    ["2026-08-10", "Hele sammenligningsperioden er ikke lenger tilgjengelig"],
  ])("suppresses misleading deltas when complete history is unavailable: %s", async (retentionStartDate, message) => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue({
      ...stats(80, 40),
      retentionStartDate,
    });
    renderComparison();
    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.queryByText("+20")).not.toBeInTheDocument();
    expect(screen.queryByText("Endring")).not.toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("refreshes the previous period through the shared stats invalidation family", async () => {
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(80, 40));
    const client = renderComparison();
    await screen.findByText("+20");
    vi.mocked(fetchStatsServerFn).mockResolvedValue(stats(70, 40));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["stats"] });
    });
    expect(await screen.findByText("+30")).toBeInTheDocument();
  });
});

const ratingField: FieldStat = {
  fieldId: "rating",
  fieldType: "RATING",
  label: "Vurdering",
  stats: {
    type: "rating",
    ratingVariant: "emoji",
    ratingScale: 5,
    average: 4,
    distribution: { "4": 100 },
  },
};

describe("text field context", () => {
  const field: FieldStat = {
    fieldId: "comment",
    fieldType: "TEXT",
    label: "Kommentar",
    stats: {
      type: "text",
      responseCount: 10,
      responseRate: 0.1,
      topKeywords: [],
      recentResponses: [],
    },
  };

  it.each([
    0, 1, 259, 1259,
  ])("shows %i current text answers without a comparison or percentage", (responseCount) => {
    const { container } = render(
      <TextFieldCard
        field={{
          ...field,
          stats: { ...field.stats, responseCount } as typeof field.stats,
        }}
        totalCount={2000}
        semanticHeading
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Kommentar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `${responseCount.toLocaleString("nb-NO")} tekstsvar i valgt periode`,
        { normalizer: (text) => text },
      ),
    ).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("Endring");
    expect(container.textContent).not.toContain("%");
    expect(container.textContent).not.toContain("Svarandel");
  });
});

describe("rating metric names", () => {
  it("honors the definition even when a five-point scale only has values 1 and 2", () => {
    const field: FieldStat = {
      ...ratingField,
      stats: {
        type: "rating",
        average: 1.5,
        distribution: { "1": 2, "2": 2 },
        ratingVariant: "emoji",
        ratingScale: 5,
      },
    };
    expect(getRatingMetric(field)).toMatchObject({
      variant: "emoji",
      formatted: "1,5 av 5",
    });
  });

  it("never guesses semantics from an ambiguous historical distribution", () => {
    const field: FieldStat = {
      ...ratingField,
      stats: {
        type: "rating",
        average: 1.5,
        distribution: { "1": 2, "2": 2 },
        ratingVariant: null,
        ratingScale: null,
      },
    };
    expect(getRatingMetric(field)).toMatchObject({
      variant: "unknown",
      formatted: "1,5",
    });
    expect(ratingFieldsAreComparable(field, field)).toBe(false);
  });

  it("calls a verified NPS metric NPS, not an average", () => {
    const metric = getRatingMetric({
      fieldId: "nps",
      fieldType: "RATING",
      label: "Anbefale?",
      stats: {
        type: "rating",
        ratingVariant: "nps",
        ratingScale: 11,
        average: 9,
        distribution: { "9": 5 },
      },
    });
    expect(metric.label).toBe("NPS");
    expect(metric.formatted).toBe("+100 NPS");
  });
});
