import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { redactFeedbackServerFn } from "~/server/actions/redactFeedback";
import type { RedactFeedbackInput } from "~/utils/textRedaction";

const TEXT_QUERY_ROOTS = new Set([
  "feedback",
  "stats",
  "question-trend",
  "discoveryStats",
  "blockerStats",
  "topTasksStats",
  "taskPriorityStats",
  "surveyTypeDistribution",
]);

/** Remove old values, including inactive filters, rather than keeping stale text visible. */
export async function resetRedactedFeedbackQueries(
  queryClient: QueryClient,
  options?: { requireFreshFeedback?: boolean },
): Promise<void> {
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      TEXT_QUERY_ROOTS.has(String(query.queryKey[0])),
  };
  await queryClient.cancelQueries(filters);
  // throwOnError leaves paused refetch rejections unhandled when offline.
  await queryClient.resetQueries(filters);
  if (
    options?.requireFreshFeedback &&
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ["feedback"], type: "active" })
      .some(
        ({ state }) =>
          state.status !== "success" || state.fetchStatus === "paused",
      )
  ) {
    throw new Error("Could not refresh feedback.");
  }
}

export function useRedactFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RedactFeedbackInput) =>
      redactFeedbackServerFn({ data: input }),
    retry: false,
    onSuccess: () => resetRedactedFeedbackQueries(queryClient),
  });
}
