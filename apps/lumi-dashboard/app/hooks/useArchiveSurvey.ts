import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import {
  archiveSurveyServerFn,
  unarchiveSurveyServerFn,
} from "~/server/actions";

/**
 * Mutations for archiving/restoring a survey (team-scoped display metadata).
 * Archiving only hides the survey in the dashboard — submissions continue
 * until the consuming app removes the widget.
 */
export function useArchiveSurvey() {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  const invalidateBootstrap = () => {
    queryClient.invalidateQueries({ queryKey: ["filterBootstrap"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (surveyId: string) =>
      archiveSurveyServerFn({ data: { surveyId, team: params.team } }),
    onSuccess: invalidateBootstrap,
  });

  const restoreMutation = useMutation({
    mutationFn: (surveyId: string) =>
      unarchiveSurveyServerFn({ data: { surveyId, team: params.team } }),
    onSuccess: invalidateBootstrap,
  });

  return { archiveMutation, restoreMutation };
}
