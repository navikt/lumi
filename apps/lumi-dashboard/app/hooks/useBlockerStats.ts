import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchBlockerServerFn } from "~/server/actions/fetchBlocker";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export type { BlockerResponse } from "~/types/api";

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
      params.task,
      params.rating,
      params.choice,
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
          task: params.task,
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
        },
      }),
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}
