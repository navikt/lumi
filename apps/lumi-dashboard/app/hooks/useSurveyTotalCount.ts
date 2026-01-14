import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchFeedbackServerFn } from "~/server/actions";

/**
 * Hook to fetch the total count of feedback items for a survey,
 * ignoring any other filters. Used by DeleteSurveyDialog to show
 * accurate deletion count.
 *
 * @param surveyId - The survey ID to count
 * @param enabled - Whether to run the query (e.g., only when dialog is open)
 */
export function useSurveyTotalCount(surveyId: string, enabled = true) {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: ["survey-total-count", { team: params.team, surveyId }],
    queryFn: async () => {
      // Fetch first page with size=1 to get totalElements count only
      const result = await fetchFeedbackServerFn({
        data: {
          team: params.team,
          surveyId,
          // fetchFeedbackServerFn expects 1-indexed pages (it converts to backend 0-indexed)
          page: "1",
          size: "1", // Minimal data transfer, just need totalElements
        },
      });
      return result.totalElements;
    },
    enabled: enabled && !!surveyId,
    staleTime: 30 * 1000, // 30 seconds - count doesn't need to be super fresh
  });
}
