import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchBlockerServerFn } from "~/server/actions/fetchBlocker";

// Re-export BlockerResponse type for components that need it
export type { BlockerResponse } from "~/types/api";

/**
 * Hook to fetch Blocker pattern statistics for Top Tasks.
 * Returns word frequency, themes (patterns), and recent blocker text.
 */
export function useBlockerStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "blockerStats",
      params.team,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
      params.task, // Task filter for drill-down
    ],
    queryFn: () =>
      fetchBlockerServerFn({
        data: {
          team: params.team,
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          deviceType: params.deviceType,
          task: params.task, // Pass task filter to backend
        },
      }),
    staleTime: 60000, // 1 minute
    placeholderData: keepPreviousData,
  });
}
