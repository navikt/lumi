import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchQuestionTrendServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export function useQuestionTrend(
  enabled = true,
  fieldOverride?: string,
  intervalOverride?: "day" | "week" | "month",
) {
  const { params } = useSearchParams();
  const interval = intervalOverride ?? params.trendInterval ?? "week";
  const fieldId = fieldOverride ?? params.trendField;

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
      fieldId,
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
          fieldId: fieldId as string,
          interval,
        },
      }),
    enabled: enabled && Boolean(params.surveyId && fieldId),
    staleTime: 30000,
  });
}
