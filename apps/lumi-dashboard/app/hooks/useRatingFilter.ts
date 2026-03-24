import { useSearchParams } from "~/hooks/useSearchParams";
import {
  parseRatingParam,
  stringifyRatingFilters,
} from "~/utils/ratingFilterUtils";

export function useRatingFilter() {
  const { params, setParams } = useSearchParams();
  const activeFilters = parseRatingParam(params.rating);

  const toggleRating = (fieldId: string, ratingValue: string) => {
    const current = { ...activeFilters };
    if (current[fieldId] === ratingValue) {
      delete current[fieldId];
    } else {
      current[fieldId] = ratingValue;
    }

    setParams({
      rating: stringifyRatingFilters(current),
      page: "1",
    });
  };

  const removeRating = (fieldId: string) => {
    if (!(fieldId in activeFilters)) return;

    const current = { ...activeFilters };
    delete current[fieldId];

    setParams({
      rating: stringifyRatingFilters(current),
      page: "1",
    });
  };

  const clearRatings = () => {
    setParams({ rating: undefined, page: "1" });
  };

  const isActive = (fieldId: string, ratingValue?: string): boolean => {
    if (ratingValue === undefined) {
      return fieldId in activeFilters;
    }
    return activeFilters[fieldId] === ratingValue;
  };

  return {
    activeFilters,
    hasFilters: Object.keys(activeFilters).length > 0,
    toggleRating,
    removeRating,
    clearRatings,
    isActive,
  };
}
