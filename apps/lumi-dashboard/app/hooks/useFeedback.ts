import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchFeedbackServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";

export type { FeedbackPage } from "~/types/api";

export function useFeedback() {
  const { params } = useSearchParams();

  // Canonicalize: when phrase is active, ignore free-text query to avoid
  // conflicting filters (phrase is the more specific filter).
  const effectiveQuery = params.phrase ? undefined : params.query;

  return useQuery({
    queryKey: [
      "feedback",
      params.team,
      params.app,
      params.surveyId,
      params.page,
      params.size,
      params.fromDate,
      params.toDate,
      params.hasText,
      effectiveQuery,
      params.tag,
      params.lowRating,
      params.deviceType,
      params.theme,
      params.task,
      params.segment,
      params.rating,
      params.choice,
      params.phrase,
    ],
    queryFn: () =>
      fetchFeedbackServerFn({
        data: {
          team: params.team,
          app: params.app,
          surveyId: params.surveyId,
          page: params.page,
          size: params.size || "20",
          fromDate: params.fromDate,
          toDate: params.toDate,
          hasText: params.hasText,
          query: effectiveQuery,
          tag: params.tag,
          lowRating: params.lowRating,
          deviceType: params.deviceType,
          theme: params.theme,
          task: params.task,
          segment: params.segment,
          rating: splitRatingParam(params.rating),
          choice: splitChoiceParam(params.choice),
          phrase: params.phrase,
        },
      }),
    staleTime: 10000,
    placeholderData: keepPreviousData,
  });
}
