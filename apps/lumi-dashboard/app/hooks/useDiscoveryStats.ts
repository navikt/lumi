import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchDiscoveryServerFn } from "~/server/actions";

// Re-export DiscoveryResponse type for components that need it
export type { DiscoveryResponse } from "~/types/api";

/**
 * Hook to fetch Discovery survey statistics.
 * Returns word frequency, themes, and recent responses for intent analysis.
 */
export function useDiscoveryStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "discoveryStats",
      params.team,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
    ],
    queryFn: () =>
      fetchDiscoveryServerFn({
        data: {
          team: params.team,
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          deviceType: params.deviceType,
        },
      }),
    staleTime: 60000, // 1 minute
    placeholderData: keepPreviousData,
  });
}
