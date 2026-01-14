import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchSurveysByAppServerFn } from "~/server/actions";

/**
 * Hook to fetch surveys grouped by app.
 * Returns a mapping of app name -> array of surveyIds
 */
export function useSurveysByApp() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: ["surveysByApp", { team: params.team }],
    queryFn: () => fetchSurveysByAppServerFn({ data: { team: params.team } }),
    staleTime: 60000, // 1 minute - these don't change often
  });
}
