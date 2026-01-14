import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchStatsServerFn } from "~/server/actions";

// Re-export the FeedbackStats type from schemas for components that need it
export type { FeedbackStats } from "~/types/api";

/**
 * Hook to fetch aggregated feedback statistics.
 *
 * Automatically reacts to URL search params for filtering by:
 * - app: Filter by application name
 * - fromDate/toDate: Date range filter
 * - surveyId: Filter by specific survey ID
 * - deviceType: Filter by device type (mobile/tablet/desktop)
 * - task: Filter by specific task (Top Tasks drill-down)
 *
 * @returns React Query result with FeedbackStats data
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data: stats, isLoading } = useStats();
 *   if (isLoading) return <Spinner />;
 *   return <div>Total: {stats.totalCount}</div>;
 * }
 * ```
 */
export function useStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "stats",
      params.team,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
      params.segment,
      params.task, // Task filter for Top Tasks drill-down
    ],
    queryFn: () =>
      fetchStatsServerFn({
        data: {
          team: params.team,
          app: params.app,
          fromDate: params.fromDate,
          toDate: params.toDate,
          surveyId: params.surveyId,
          deviceType: params.deviceType,
          segment: params.segment,
          task: params.task, // Pass task filter to backend
        },
      }),
    staleTime: 30000, // 30 seconds
    placeholderData: keepPreviousData, // Prevent skeleton flash on param changes
  });
}
