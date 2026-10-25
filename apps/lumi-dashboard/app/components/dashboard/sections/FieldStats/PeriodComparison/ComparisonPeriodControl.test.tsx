import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchParams } from "~/schemas/searchSchema";
import { ComparisonPeriodControl } from "./ComparisonPeriodControl";

const { params } = vi.hoisted(() => ({ params: {} as Partial<SearchParams> }));

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: () => ({ params, setParams: vi.fn() }),
}));

vi.mock("~/hooks/useAnswerSpan", () => {
  const span = { fromDate: "2025-12-29", toDate: "2026-10-24" };
  return {
    useAnswerSpan: () => span,
    useAnswerSpanState: () => ({ span, isLoaded: true }),
  };
});

vi.mock("~/hooks/useOsloToday", () => ({
  useOsloToday: () => "2026-10-25",
}));

vi.mock("~/hooks/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

describe("ComparisonPeriodControl", () => {
  beforeEach(() => {
    for (const key of Object.keys(params)) {
      delete params[key as keyof SearchParams];
    }
  });

  it("explains that «Fra første svar» has no previous period", () => {
    Object.assign(params, {
      dateMode: "relative",
      periodPreset: "sinceFirst",
      toDate: "2026-10-25",
      compare: "previous",
    });

    render(<ComparisonPeriodControl />);

    expect(
      screen.getByRole("button", {
        name: "Periode: Fra første svar (29.12.2025)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ingen forrige periode å sammenligne med når perioden starter ved første svar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sammenlign med forrige periode"),
    ).not.toBeInTheDocument();
  });

  it("offers the comparison for a fixed period", () => {
    Object.assign(params, {
      dateMode: "fixed",
      fromDate: "2026-10-01",
      toDate: "2026-10-14",
      compare: "previous",
    });

    render(<ComparisonPeriodControl />);

    expect(
      screen.getByText("Sammenlign med forrige periode"),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Mot /)).toBeInTheDocument();
  });
});
