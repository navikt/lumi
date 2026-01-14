import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchTaskPriorityServerFn } from "~/server/actions";

// Re-export TaskPriorityResponse type for components that need it
export type { TaskPriorityResponse } from "~/types/api";

/**
 * Hook to fetch Task Priority survey statistics.
 * Returns the "Long Neck" distribution of task votes.
 */
export function useTaskPriorityStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "taskPriorityStats",
      params.team,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
      params.segment,
    ],
    queryFn: () =>
      fetchTaskPriorityServerFn({
        data: {
          team: params.team,
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          deviceType: params.deviceType,
          segment: params.segment,
        },
      }),
    staleTime: 60000, // 1 minute
    placeholderData: keepPreviousData,
  });
}
