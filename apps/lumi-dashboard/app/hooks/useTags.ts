import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import {
  addTagServerFn,
  fetchTagsServerFn,
  removeTagServerFn,
} from "~/server/actions";

/**
 * Hook to fetch all available tags.
 *
 * @returns React Query result with array of tag strings
 *
 * @example
 * ```tsx
 * function TagFilter() {
 *   const { data: tags } = useTags();
 *   return <Select options={tags?.map(t => ({ label: t, value: t }))} />;
 * }
 * ```
 */
export function useTags() {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: ["tags", { team: params.team }],
    queryFn: () => fetchTagsServerFn({ data: { team: params.team } }),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to add a tag to a feedback item.
 * Automatically invalidates feedback and tags queries on success.
 *
 * @returns Mutation function that takes { id, tag }
 *
 * @example
 * ```tsx
 * function TagButton({ id }) {
 *   const addTag = useAddTag();
 *   return <Button onClick={() => addTag.mutate({ id, tag: "important" })}>Add</Button>;
 * }
 * ```
 */
export function useAddTag() {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      addTagServerFn({ data: { id, tag, team: params.team } }),
    onSuccess: () => {
      // Invalidate both feedback and tags queries
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

/**
 * Hook to remove a tag from a feedback item.
 * Automatically invalidates feedback and tags queries on success.
 *
 * @returns Mutation function that takes { id, tag }
 */
export function useRemoveTag() {
  const queryClient = useQueryClient();
  const { params } = useSearchParams();

  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      removeTagServerFn({ data: { id, tag, team: params.team } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
