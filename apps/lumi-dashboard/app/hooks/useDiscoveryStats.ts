import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchDiscoveryServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export type { DiscoveryResponse } from "~/types/api";

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
      params.rating,
      params.choice,
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
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
        },
      }),
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}
