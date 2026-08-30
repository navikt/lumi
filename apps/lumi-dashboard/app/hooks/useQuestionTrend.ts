import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchQuestionTrendServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export function useQuestionTrend(enabled = true) {
  const { params } = useSearchParams();
  const interval = params.trendInterval ?? "week";

  return useQuery({
    queryKey: [
      "question-trend",
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
      params.trendField,
      interval,
    ],
    queryFn: () =>
      fetchQuestionTrendServerFn({
        data: {
          team: params.team,
          includeArchived: params.showArchived === "true" ? "true" : undefined,
          app: params.app,
          fromDate: params.fromDate,
          toDate: params.toDate,
          surveyId: params.surveyId as string,
          deviceType: params.deviceType,
          segment: params.segment,
          task: params.task,
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
          fieldId: params.trendField as string,
          interval,
        },
      }),
    enabled: enabled && Boolean(params.surveyId && params.trendField),
    staleTime: 30000,
  });
}
