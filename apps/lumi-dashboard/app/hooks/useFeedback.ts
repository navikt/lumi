import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchFeedbackServerFn } from "~/server/actions";

// Re-export the FeedbackPage type for components that need it
export type { FeedbackPage } from "~/types/api";

/**
 * Hook to fetch paginated feedback items.
 *
 * Automatically reacts to URL search params for filtering and pagination:
 * - app: Filter by application name
 * - surveyId: Filter by specific survey ID
 * - page/size: Pagination controls (1-indexed)
 * - fromDate/toDate: Date range filter
 * - hasText: Filter to only items with text responses
 * - lowRating: Filter to only low ratings (1-2)
 * - tag: Filter by comma-separated tags
 * - deviceType: Filter by device type
 * - segment: Filter by context.tags (format: key:value)
 *
 * @returns React Query result with FeedbackPage (content, pagination info)
 *
 * @example
 * ```tsx
 * function FeedbackList() {
 *   const { data, isLoading } = useFeedback();
 *   if (isLoading) return <Spinner />;
 *   return data.content.map(item => <FeedbackCard key={item.id} {...item} />);
 * }
 * ```
 */
export function useFeedback() {
  const { params } = useSearchParams();

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
      params.query,
      params.tag,
      params.lowRating,
      params.pathname,
      params.deviceType,
      params.theme,
      params.segment,
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
          query: params.query,
          tag: params.tag,
          lowRating: params.lowRating,
          deviceType: params.deviceType,
          theme: params.theme,
          segment: params.segment,
        },
      }),
    staleTime: 10000, // 10 seconds
    placeholderData: keepPreviousData, // Prevent skeleton flash on param changes
  });
}
