import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchParams } from "~/hooks/useSearchParams";
import type { FieldStat } from "~/types/api";
import { RatingFieldCard } from "../RatingFieldCard";

vi.mock("~/hooks/useSearchParams", () => ({
  useSearchParams: vi.fn(),
}));

const mockUseSearchParams = vi.mocked(useSearchParams);

function givenSearchParams(params: Record<string, string | undefined>) {
  const setParams = vi.fn();
  mockUseSearchParams.mockReturnValue({
    params,
    setParam: vi.fn(),
    setParams,
    resetParams: vi.fn(),
  } as never);
  return { setParams };
}

function makeRatingField(
  overrides?: Partial<FieldStat>,
  distribution: Record<string, number> = {
    "1": 1,
    "2": 3,
    "3": 6,
    "4": 10,
    "5": 20,
  },
): FieldStat {
  return {
    fieldId: "rating-1",
    fieldType: "RATING",
    label: "Hvor fornøyd er du?",
    stats: {
      type: "rating",
      average: 4.2,
      distribution,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RatingFieldCard", () => {
  it("sets ratingFieldId/ratingValue/page when selecting a non-thumbs rating bar", async () => {
    const user = userEvent.setup();
    const { setParams } = givenSearchParams({});

    render(<RatingFieldCard field={makeRatingField()} totalCount={100} />);

    const [highestRatingButton] = screen.getAllByRole("button");
    await user.click(highestRatingButton);

    expect(setParams).toHaveBeenCalledWith({
      ratingFieldId: "rating-1",
      ratingValue: "5",
      page: "1",
    });
  });

  it("clears rating params when re-clicking the selected non-thumbs bar", async () => {
    const user = userEvent.setup();
    const { setParams } = givenSearchParams({
      ratingFieldId: "rating-1",
      ratingValue: "4",
    });

    render(<RatingFieldCard field={makeRatingField()} totalCount={100} />);

    const [highestRatingButton, secondHighestRatingButton] =
      screen.getAllByRole("button");

    expect(highestRatingButton).toHaveAttribute("aria-pressed", "false");
    expect(secondHighestRatingButton).toHaveAttribute("aria-pressed", "true");

    await user.click(secondHighestRatingButton);

    expect(setParams).toHaveBeenCalledWith({
      ratingFieldId: undefined,
      ratingValue: undefined,
      page: "1",
    });
  });

  it("passes thumbs interactions through existing drilldown handlers", async () => {
    const user = userEvent.setup();
    const { setParams } = givenSearchParams({});

    const thumbsField = makeRatingField(
      { fieldId: "thumbs-1", label: "Var dette nyttig?" },
      { "1": 4, "2": 11 },
    );

    render(<RatingFieldCard field={thumbsField} totalCount={15} />);

    await user.click(screen.getByTestId("thumbs-drilldown-thumbs-1-2"));

    expect(setParams).toHaveBeenCalledWith({
      ratingFieldId: "thumbs-1",
      ratingValue: "2",
      page: "1",
    });
  });
});
