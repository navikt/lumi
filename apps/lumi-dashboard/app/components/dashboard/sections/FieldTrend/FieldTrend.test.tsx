import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFieldTrend } from "~/hooks/useFieldTrend";
import { useSearchParams } from "~/hooks/useSearchParams";
import type { FieldTrendResponse } from "~/types/api";
import { FieldTrendSection } from ".";

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid="trend-line" data-key={dataKey}>
      {name}
    </div>
  ),
  LineChart: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    "aria-label"?: string;
  }) => (
    <div role="img" aria-label={ariaLabel}>
      {children}
    </div>
  ),
  Tooltip: ({ filterNull }: { filterNull?: boolean }) => (
    <div data-testid="trend-tooltip" data-filter-null={String(filterNull)} />
  ),
  XAxis: ({ tickFormatter }: { tickFormatter: (value: string) => string }) => (
    <div data-testid="trend-axis-label">{tickFormatter("2026-08-03")}</div>
  ),
  YAxis: ({
    allowDecimals,
    domain,
  }: {
    allowDecimals?: boolean;
    domain: [number, number];
  }) => (
    <div
      data-testid="trend-axis"
      data-allow-decimals={String(allowDecimals)}
      data-domain={domain.join(":")}
    />
  ),
}));

vi.mock(
  "~/components/shared/Charts/ResponsiveContainerWithInitialSize",
  () => ({
    ResponsiveContainerWithInitialSize: ({
      children,
    }: {
      children: ReactNode;
    }) => <div>{children}</div>,
  }),
);

vi.mock("~/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("~/hooks/useSearchParams", () => ({ useSearchParams: vi.fn() }));
vi.mock("~/hooks/useFieldTrend", () => ({ useFieldTrend: vi.fn() }));

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseFieldTrend = vi.mocked(useFieldTrend);
const setParams = vi.fn();

const baseResponse: FieldTrendResponse = {
  fields: [
    {
      fieldId: "identified",
      fieldType: "SINGLE_CHOICE",
      label: "Ble behovet identifisert?",
      options: [
        { id: "yes", label: "Ja" },
        { id: "no", label: "Nei" },
      ],
      ratingVariant: null,
      ratingScale: null,
      ratingMin: null,
      ratingMax: null,
    },
  ],
  trend: {
    fieldId: "identified",
    granularity: "week",
    points: [
      {
        periodStart: "2026-08-03",
        responseCount: 10,
        average: null,
        distribution: { yes: 6, no: 4 },
        masked: false,
        empty: false,
      },
    ],
  },
  privacyThreshold: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSearchParams.mockReturnValue({
    params: {
      surveyId: "survey-1",
      trendFieldId: "identified",
      trendGranularity: "week",
      trendMeasure: "percentage",
    },
    setParam: vi.fn(),
    setParams,
    resetParams: vi.fn(),
  } as never);
  mockUseFieldTrend.mockReturnValue({
    data: baseResponse,
    error: null,
    isPending: false,
    isFetching: false,
    isPlaceholderData: false,
  } as never);
});

describe("FieldTrendSection", () => {
  it("shows a selected choice field as chart and accessible table", async () => {
    const user = userEvent.setup();
    render(<FieldTrendSection />);

    expect(
      screen.getByRole("heading", { name: "Utvikling per spørsmål" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Spørsmål" })).toHaveValue(
      "identified",
    );
    expect(screen.getAllByText("Ja").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nei").length).toBeGreaterThan(0);
    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(screen.getByTestId("trend-axis-label")).toHaveTextContent(
      "Uke 32, 2026",
    );

    await user.click(screen.getByRole("radio", { name: "Antall" }));
    expect(setParams).toHaveBeenCalledWith({ trendMeasure: "count" });
  });

  it("writes deterministic defaults and replaces a stale field in the URL", async () => {
    mockUseSearchParams.mockReturnValue({
      params: { surveyId: "survey-1", trendFieldId: "old-field" },
      setParam: vi.fn(),
      setParams,
      resetParams: vi.fn(),
    } as never);

    render(<FieldTrendSection />);

    await waitFor(() =>
      expect(setParams).toHaveBeenCalledWith({
        trendFieldId: "identified",
        trendGranularity: "week",
        trendMeasure: "percentage",
        trendOptionId: undefined,
      }),
    );
  });

  it("distinguishes masked intervals from intervals without answers", () => {
    mockUseFieldTrend.mockReturnValue({
      data: {
        ...baseResponse,
        trend: {
          fieldId: "identified",
          granularity: "week",
          points: [
            {
              periodStart: "2026-08-03",
              responseCount: null,
              average: null,
              distribution: {},
              masked: true,
              empty: false,
            },
            {
              periodStart: "2026-08-10",
              responseCount: 0,
              average: null,
              distribution: {},
              masked: false,
              empty: true,
            },
            {
              periodStart: "2026-08-17",
              responseCount: 5,
              average: null,
              distribution: { yes: 5 },
              masked: false,
              empty: false,
            },
          ],
        },
      },
      error: null,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    expect(screen.getByTestId("trend-tooltip")).toHaveAttribute(
      "data-filter-null",
      "false",
    );
    expect(
      screen.getByText(
        "Noen tidsintervaller er skjult fordi de har færre enn 5 svar.",
      ),
    ).toBeInTheDocument();

    screen.getByText("Vis data som tabell").click();
    expect(screen.getByText("Skjult – færre enn 5 svar")).toBeInTheDocument();
    expect(screen.getByText("Ingen svar")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Trenddata i tabell" }),
    ).toContainElement(screen.getByRole("table"));
    expect(screen.getByRole("table")).toHaveAttribute("tabindex", "0");
  });

  it("uses the definition-backed NPS scale for rating surveys", () => {
    mockUseFieldTrend.mockReturnValue({
      data: {
        fields: [
          {
            fieldId: "opplevelse",
            fieldType: "RATING",
            label: "Hvordan var opplevelsen?",
            options: [],
            ratingVariant: "nps",
            ratingScale: 11,
            ratingMin: 0,
            ratingMax: 10,
          },
        ],
        trend: {
          fieldId: "opplevelse",
          granularity: "week",
          points: [
            {
              periodStart: "2026-08-03",
              responseCount: 5,
              average: 3,
              distribution: {},
              masked: false,
              empty: false,
            },
          ],
        },
        privacyThreshold: 5,
      },
      error: null,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    expect(screen.getByTestId("trend-axis")).toHaveAttribute(
      "data-domain",
      "0:10",
    );
    expect(screen.getAllByText("Gjennomsnitt")).toHaveLength(2);
  });

  it("maps arbitrary option IDs to generated chart keys", () => {
    const specialIds = ["periodStart", "masked", "foo.bar"];
    mockUseFieldTrend.mockReturnValue({
      data: {
        fields: [
          {
            ...baseResponse.fields[0],
            options: specialIds.map((id) => ({ id, label: id })),
          },
        ],
        trend: {
          fieldId: "identified",
          granularity: "week",
          points: [
            {
              periodStart: "2026-08-03",
              responseCount: 5,
              average: null,
              distribution: Object.fromEntries(specialIds.map((id) => [id, 5])),
              masked: false,
              empty: false,
            },
          ],
        },
        privacyThreshold: 5,
      },
      error: null,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    expect(
      screen.getAllByTestId("trend-line").map((line) => line.dataset.key),
    ).toEqual(["series_0", "series_1", "series_2"]);
  });

  it("uses integer ticks when the choice measure is count", () => {
    mockUseSearchParams.mockReturnValue({
      params: {
        surveyId: "survey-1",
        trendFieldId: "identified",
        trendGranularity: "week",
        trendMeasure: "count",
      },
      setParam: vi.fn(),
      setParams,
      resetParams: vi.fn(),
    } as never);

    render(<FieldTrendSection />);

    expect(screen.getByTestId("trend-axis")).toHaveAttribute(
      "data-allow-decimals",
      "false",
    );
  });

  it("limits a high-cardinality chart to a selectable series while retaining all table columns", async () => {
    const user = userEvent.setup();
    const options = Array.from({ length: 10 }, (_, index) => ({
      id: `option-${index}`,
      label: `Alternativ ${index}`,
    }));
    mockUseFieldTrend.mockReturnValue({
      data: {
        fields: [{ ...baseResponse.fields[0], options }],
        trend: {
          fieldId: "identified",
          granularity: "week",
          points: [
            {
              periodStart: "2026-08-03",
              responseCount: 10,
              average: null,
              distribution: Object.fromEntries(
                options.map((option) => [option.id, 5]),
              ),
              masked: false,
              empty: false,
            },
          ],
        },
        privacyThreshold: 5,
      },
      error: null,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    const seriesSelect = screen.getByRole("combobox", {
      name: /Svaralternativ i grafen/,
    });
    expect(screen.getAllByTestId("trend-line")).toHaveLength(1);
    expect(
      screen.getByRole("img", {
        name: /svaralternativ Alternativ 0/,
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(setParams).toHaveBeenCalledWith({
        trendOptionId: "option-0",
      }),
    );
    await user.selectOptions(seriesSelect, "option-9");
    expect(setParams).toHaveBeenLastCalledWith({
      trendOptionId: "option-9",
    });

    await user.click(screen.getByText("Vis data som tabell"));
    expect(
      screen.getByRole("columnheader", { name: "Alternativ 9" }),
    ).toBeVisible();
  });

  it("keeps cached data visible when a background refresh fails", () => {
    mockUseFieldTrend.mockReturnValue({
      data: baseResponse,
      error: new Error("refresh failed"),
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
    } as never);

    render(<FieldTrendSection />);

    expect(
      screen.getByText(
        "Oppdateringen feilet. Vi viser sist hentede utvikling.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Spørsmål" })).toHaveValue(
      "identified",
    );
  });
});
