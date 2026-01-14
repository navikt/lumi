import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { deleteFeedbackServerFn } from "~/server/actions";

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  return useMutation({
    mutationFn: (id: string) =>
      deleteFeedbackServerFn({ data: { id, team: params.team } }),
    onSuccess: () => {
      // Invalidate feedback queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
