import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchStatsServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export type { FeedbackStats } from "~/types/api";

export function useStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "stats",
      params.team,
      params.showArchived,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
      params.segment,
      params.task,
      params.rating,
      params.choice,
      params.trendFieldId,
      params.trendGranularity,
    ],
    queryFn: () =>
      fetchStatsServerFn({
        data: {
          team: params.team,
          includeArchived: params.showArchived === "true" ? "true" : undefined,
          app: params.app,
          fromDate: params.fromDate,
          toDate: params.toDate,
          surveyId: params.surveyId,
          deviceType: params.deviceType,
          segment: params.segment,
          task: params.task,
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
          trendFieldId: params.surveyId ? params.trendFieldId : undefined,
          trendGranularity:
            params.surveyId && params.trendFieldId
              ? (params.trendGranularity ?? "week")
              : undefined,
        },
      }),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}
