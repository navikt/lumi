import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchQuestionTrendServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";
import type { TimeInterval } from "~/utils/timeBuckets";

/**
 * The trend for one question. The caller gives the resolution, from
 * `useSeriesWindow` or the viewer's choice, and the chart's heading names the
 * same one.
 */
export function useQuestionTrend(
  enabled: boolean,
  fieldOverride: string | undefined,
  interval: TimeInterval,
) {
  const { params } = useSearchParams();
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
