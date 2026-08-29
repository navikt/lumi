import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchFieldTrendServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export function useFieldTrend() {
  const { params } = useSearchParams();
  const granularity = params.trendGranularity ?? "week";

  return useQuery({
    queryKey: [
      "field-trend",
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
      granularity,
    ],
    queryFn: () =>
      fetchFieldTrendServerFn({
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
          fieldId: params.trendFieldId,
          granularity,
        },
      }),
    enabled: Boolean(params.surveyId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
