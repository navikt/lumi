import { useCachedFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { type DateRange, getAnswerSpan } from "~/utils/dashboardPeriod";

/**
 * First and last day with answers, as days in Oslo, for the selected survey,
 * app or team. Undefined until FilterBar has loaded the filter bootstrap, or
 * when it has no submission dates.
 */
export function useAnswerSpan(): DateRange | undefined {
  const { params } = useSearchParams();
  const { data: bootstrap } = useCachedFilterBootstrap();

  return getAnswerSpan(bootstrap, {
    surveyId: params.surveyId,
    app: params.app,
    includeArchived: params.showArchived === "true",
  });
}
