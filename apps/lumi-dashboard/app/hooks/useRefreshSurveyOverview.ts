import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { filterBootstrapQueryKey } from "~/hooks/useFilterBootstrap";
import { type SearchParams, useSearchParams } from "~/hooks/useSearchParams";
import { refreshFilterBootstrapServerFn } from "~/server/actions";
import { resolveDashboardPeriod } from "~/utils/dashboardPeriod";

type RefreshContext = Pick<
  SearchParams,
  "team" | "app" | "surveyId" | "dateMode" | "fromDate" | "toDate"
>;

function snapshotRefreshContext(params: SearchParams): RefreshContext {
  return {
    team: params.team,
    app: params.app,
    surveyId: params.surveyId,
    dateMode: params.dateMode,
    fromDate: params.fromDate,
    toDate: params.toDate,
  };
}

function isSameRefreshContext(
  current: RefreshContext,
  requested: RefreshContext,
) {
  return (Object.keys(requested) as Array<keyof RefreshContext>).every(
    (key) => current[key] === requested[key],
  );
}

/**
 * Fetches survey/filter metadata without the five-minute bootstrap cache.
 *
 * Feedback is also invalidated because that API is uncached. Statistics are
 * deliberately left alone: their server-side caches have a separate contract,
 * so this action must not imply that every dashboard card is immediately fresh.
 */
export function useRefreshSurveyOverview() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { params } = useSearchParams();
  const latestParams = useRef(params);
  latestParams.current = params;

  return useMutation({
    mutationFn: async () => {
      const refreshContext = snapshotRefreshContext(latestParams.current);
      const bootstrapQueryKey = filterBootstrapQueryKey(refreshContext.team);
      // Ignore a late ordinary response after the forced request has returned.
      await queryClient.cancelQueries({
        queryKey: bootstrapQueryKey,
        exact: true,
      });
      const bootstrap = await refreshFilterBootstrapServerFn({
        data: { team: refreshContext.team },
      });
      return { bootstrap, bootstrapQueryKey, refreshContext };
    },
    onSuccess: async ({ bootstrap, bootstrapQueryKey, refreshContext }) => {
      // Cancel an ordinary request that may have started while the forced request
      // was running, then cache the response under the team actually requested.
      await queryClient.cancelQueries({
        queryKey: bootstrapQueryKey,
        exact: true,
      });
      queryClient.setQueryData(bootstrapQueryKey, bootstrap);

      if (
        !isSameRefreshContext(
          snapshotRefreshContext(latestParams.current),
          refreshContext,
        )
      ) {
        return;
      }

      const surveyMeta = refreshContext.surveyId
        ? ((refreshContext.app
            ? bootstrap.surveyMetaByApp?.[refreshContext.app]?.[
                refreshContext.surveyId
              ]
            : undefined) ?? bootstrap.surveyMeta?.[refreshContext.surveyId])
        : undefined;
      const refreshedPeriod = resolveDashboardPeriod({
        dateMode: refreshContext.dateMode,
        fromDate: refreshContext.fromDate,
        toDate: refreshContext.toDate,
        surveyMeta,
      });
      const shouldMoveAutomaticPeriod =
        refreshedPeriod.dateMode === "auto" &&
        (refreshContext.dateMode !== "auto" ||
          refreshContext.fromDate !== refreshedPeriod.fromDate ||
          refreshContext.toDate !== refreshedPeriod.toDate);

      if (shouldMoveAutomaticPeriod) {
        await navigate({
          // @ts-expect-error -- shared hook is used by both dashboard routes.
          search: (previous: Record<string, string | undefined>) => ({
            ...previous,
            dateMode: "auto",
            fromDate: refreshedPeriod.fromDate,
            toDate: refreshedPeriod.toDate,
            page: "1",
          }),
          replace: true,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });
}
