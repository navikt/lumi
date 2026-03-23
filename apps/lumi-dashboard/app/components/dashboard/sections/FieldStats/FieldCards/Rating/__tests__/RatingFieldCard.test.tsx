import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRatingFilter } from "~/hooks/useRatingFilter";
import type { FieldStat } from "~/types/api";
import { RatingFieldCard } from "../RatingFieldCard";

vi.mock("~/hooks/useRatingFilter", () => ({
  useRatingFilter: vi.fn(),
}));

const mockUseRatingFilter = vi.mocked(useRatingFilter);

function givenRatingFilter(activeFilters: Record<string, string> = {}) {
  const toggleRating = vi.fn();

  mockUseRatingFilter.mockReturnValue({
    activeFilters,
    hasFilters: Object.keys(activeFilters).length > 0,
    toggleRating,
    removeRating: vi.fn(),
    clearRatings: vi.fn(),
    isActive: vi.fn((fieldId: string, ratingValue?: string) => {
      if (ratingValue === undefined) {
        return fieldId in activeFilters;
      }
      return activeFilters[fieldId] === ratingValue;
    }),
  });

  return { toggleRating };
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
  it("toggles the selected rating when clicking a non-thumbs bar", async () => {
    const user = userEvent.setup();
    const { toggleRating } = givenRatingFilter();

    render(<RatingFieldCard field={makeRatingField()} totalCount={100} />);

    const [highestRatingButton] = screen.getAllByRole("button");
    await user.click(highestRatingButton);

    expect(toggleRating).toHaveBeenCalledWith("rating-1", "5");
  });

  it("marks the selected non-thumbs bar as active from the rating hook", () => {
    givenRatingFilter({ "rating-1": "4" });

    render(<RatingFieldCard field={makeRatingField()} totalCount={100} />);

    const [highestRatingButton, secondHighestRatingButton] =
      screen.getAllByRole("button");

    expect(highestRatingButton).toHaveAttribute("aria-pressed", "false");
    expect(secondHighestRatingButton).toHaveAttribute("aria-pressed", "true");
  });

  it("reuses toggleRating to clear the active rating filter", async () => {
    const user = userEvent.setup();
    const { toggleRating } = givenRatingFilter({ "rating-1": "4" });

    render(<RatingFieldCard field={makeRatingField()} totalCount={100} />);

    await user.click(screen.getByRole("button", { name: /Nullstill filter/i }));

    expect(toggleRating).toHaveBeenCalledWith("rating-1", "4");
  });

  it("passes thumbs interactions through the rating hook", async () => {
    const user = userEvent.setup();
    const { toggleRating } = givenRatingFilter();

    const thumbsField = makeRatingField(
      { fieldId: "thumbs-1", label: "Var dette nyttig?" },
      { "1": 4, "2": 11 },
    );

    render(<RatingFieldCard field={thumbsField} totalCount={15} />);

    await user.click(screen.getByTestId("thumbs-drilldown-thumbs-1-2"));

    expect(toggleRating).toHaveBeenCalledWith("thumbs-1", "2");
  });
});
