import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchTopTasksServerFn } from "~/server/actions";

// Re-export TopTasksResponse type for components that need it
export type { TopTasksResponse } from "~/types/api";

export function useTopTasksStats() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "topTasksStats",
      params.team,
      params.app,
      params.fromDate,
      params.toDate,
      params.surveyId,
      params.deviceType,
      params.task, // Task filter for drill-down
      params.ratingFieldId,
      params.ratingValue,
      params.choiceFieldId,
      params.choiceValue,
    ],
    queryFn: () =>
      fetchTopTasksServerFn({
        data: {
          team: params.team,
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          deviceType: params.deviceType,
          task: params.task, // Pass task filter to backend
          ratingFieldId: params.ratingFieldId,
          ratingValue: params.ratingValue,
          choiceFieldId: params.choiceFieldId,
          choiceValue: params.choiceValue,
        },
      }),
    staleTime: 60000, // 1 minute
    placeholderData: keepPreviousData,
  });
}
