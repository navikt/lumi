import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchContextTagsServerFn } from "~/server/actions";

/**
 * Hook to fetch context tags with cardinality filtering for auto-segmentation.
 *
 * @param surveyId - The survey to fetch tags for
 * @param maxCardinality - (Optional) Only return keys with <= this many unique values.
 *                         Useful for filtering out high-cardinality IDs.
 * @returns React Query result with context tags and their unique values
 *
 * @example
 * const { data, isLoading } = useContextTags("lumi-soknad", 10);
 * if (data) {
 *   // data.contextTags = { harDialogmote: ["ja", "nei"], behandlingsstatus: ["ny", "pågående"] }
 *   return (
 *     <Filters>
 *       {Object.entries(data?.contextTags ?? {}).map(([key, values]) => (
 *         <Select label={key} options={values.map(v => v.value)} />
 *       ))}
 *     </Filters>
 *   );
 * }
 */
export function useContextTags(surveyId: string, maxCardinality?: number) {
  const { params } = useSearchParams();

  return useQuery({
    queryKey: [
      "context-tags",
      surveyId,
      maxCardinality,
      params.team,
      params.task,
      params.segment,
      params.fromDate,
      params.toDate,
      params.deviceType,
      params.hasText,
      params.lowRating,
    ],
    queryFn: () =>
      fetchContextTagsServerFn({
        data: {
          surveyId: surveyId,
          maxCardinality: maxCardinality,
          team: params.team,
          task: params.task, // Pass task filter for Top Tasks drill-down
          segment: params.segment,
          fromDate: params.fromDate, // Pass period filter
          toDate: params.toDate,
          deviceType: params.deviceType,
          hasText: params.hasText === "true",
          lowRating: params.lowRating === "true",
        },
      }),
    enabled: !!surveyId,
    placeholderData: keepPreviousData,
  });
}
