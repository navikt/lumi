import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "~/hooks/useSearchParams";
import { fetchFilterBootstrapServerFn } from "~/server/actions";
import type { FilterBootstrapResponse } from "~/types/schemas";

export const FILTER_BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_REFETCH_INTERVAL_MS = 60 * 1000;

export const filterBootstrapQueryKey = (team?: string) =>
  ["filterBootstrap", { team }] as const;

export function getFilterBootstrapRefetchInterval(
  generatedAt: string | undefined,
  dataUpdatedAt: number,
) {
  const generatedAtMs = generatedAt ? Date.parse(generatedAt) : Number.NaN;
  if (!Number.isFinite(generatedAtMs) || dataUpdatedAt <= 0) {
    return FILTER_BOOTSTRAP_CACHE_TTL_MS;
  }

  const apparentCacheAge = dataUpdatedAt - generatedAtMs;
  if (apparentCacheAge <= 0) {
    return FILTER_BOOTSTRAP_CACHE_TTL_MS;
  }
  if (apparentCacheAge >= FILTER_BOOTSTRAP_CACHE_TTL_MS) {
    return MIN_REFETCH_INTERVAL_MS;
  }

  return Math.max(
    FILTER_BOOTSTRAP_CACHE_TTL_MS - apparentCacheAge,
    MIN_REFETCH_INTERVAL_MS,
  );
}

/**
 * Hook to fetch filter bootstrap data.
 *
 * Provides all data needed for FilterBar dropdowns in a single request:
 * - apps: List of available apps for the team
 * - surveysByApp: Surveys grouped by app
 * - tags: All available tags
 * - deviceTypes: Available device types
 *
 * This data is cached with a long staleTime (5 minutes) since it changes rarely.
 *
 * @example
 * ```tsx
 * function FilterBar() {
 *   const { data: bootstrap } = useFilterBootstrap();
 *
 *   return (
 *     <Select>
 *       {bootstrap?.apps.map(app => (
 *         <option key={app}>{app}</option>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 */
export function useFilterBootstrap() {
  const { params } = useSearchParams();

  return useQuery<FilterBootstrapResponse>({
    queryKey: filterBootstrapQueryKey(params.team),
    queryFn: () =>
      fetchFilterBootstrapServerFn({ data: { team: params.team } }),
    staleTime: FILTER_BOOTSTRAP_CACHE_TTL_MS,
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
    refetchInterval: (query) =>
      getFilterBootstrapRefetchInterval(
        query.state.data?.generatedAt,
        query.state.dataUpdatedAt,
      ),
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
