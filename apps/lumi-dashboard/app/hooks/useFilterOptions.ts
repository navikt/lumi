import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchStatsServerFn } from "~/server/actions";

// Re-export the FeedbackStats type for components that need it
export type { FeedbackStats } from "~/types/api";

/**
 * Hook to fetch all available filter options (apps, surveys)
 * without being affected by current filter selections.
 * This ensures dropdowns always show all available options.
 */
export function useFilterOptions() {
  return useQuery({
    queryKey: ["filterOptions"],
    queryFn: () =>
      fetchStatsServerFn({
        data: {},
      }),
    staleTime: 60000, // 1 minute - these don't change often
    placeholderData: keepPreviousData,
  });
}
