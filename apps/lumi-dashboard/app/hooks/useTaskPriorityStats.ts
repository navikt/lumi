import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchTaskPriorityServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export type { TaskPriorityResponse } from "~/types/api";

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
      params.rating,
      params.choice,
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
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
        },
      }),
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}
