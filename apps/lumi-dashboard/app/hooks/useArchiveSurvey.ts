import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
export function useArchiveSurvey(selectedSurveyId?: string) {
  const queryClient = useQueryClient();
  const { params, setParams } = useSearchParams();

  const invalidateBootstrap = () => {
    queryClient.invalidateQueries({ queryKey: ["filterBootstrap"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (surveyId: string) =>
      archiveSurveyServerFn({ data: { surveyId, team: params.team } }),
    onSuccess: (_state, surveyId) => {
      invalidateBootstrap();
      if (params.surveyId === surveyId) {
        // Keep the user's app/survey context after archiving. The toolbar's
        // archive trigger then becomes the restore trigger, so modal focus has
        // a valid return target instead of falling back to the document body.
        setParams({ showArchived: "true" });
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (surveyId: string) =>
      unarchiveSurveyServerFn({ data: { surveyId, team: params.team } }),
    onSuccess: invalidateBootstrap,
  });

  const resetArchiveMutation = archiveMutation.reset;
  const resetRestoreMutation = restoreMutation.reset;
  const previousSurveyId = useRef(selectedSurveyId);
  useEffect(() => {
    if (previousSurveyId.current === selectedSurveyId) return;
    previousSurveyId.current = selectedSurveyId;
    resetArchiveMutation();
    resetRestoreMutation();
  }, [selectedSurveyId, resetArchiveMutation, resetRestoreMutation]);

  return { archiveMutation, restoreMutation };
}
