import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { deleteSurveyServerFn } from "~/server/actions";

export function useDeleteSurvey() {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  return useMutation({
    mutationFn: (surveyId: string) =>
      deleteSurveyServerFn({ data: { surveyId, team: params.team } }),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["surveysByApp"] });
      queryClient.invalidateQueries({ queryKey: ["filterOptions"] });
    },
  });
}
