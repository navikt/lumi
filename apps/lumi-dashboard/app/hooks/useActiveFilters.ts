import { useCallback } from "react";
import { type SearchParams, useSearchParams } from "~/hooks/useSearchParams";
import { resolveDashboardPeriod } from "~/utils/dashboardPeriod";

/**
 * True when any user-adjustable filter deviates from the default view:
 * a fixed period, free-text search, or any survey/app/field filter.
 */
export function hasActiveDashboardFilters(params: SearchParams): boolean {
  return Boolean(
    params.dateMode === "fixed" || hasActiveNonPeriodFilters(params),
  );
}

/**
 * Filters that can exclude feedback independently of the selected period.
 * Kept separate so an empty state can explain a period-only miss precisely.
 */
export function hasActiveNonPeriodFilters(params: SearchParams): boolean {
  return Boolean(
    params.query ||
      params.surveyId ||
      params.app ||
      params.lowRating ||
      params.hasText ||
      params.deviceType ||
      params.tag ||
      params.segment ||
      params.task ||
      params.theme ||
      params.choice ||
      params.rating ||
      params.phrase,
  );
}

/**
 * Shared source for "are any filters active?" and the reset action, so the
 * filter bar and empty states stay in sync on what counts as a filter and
 * what the default view is.
 */
export function useActiveFilters() {
  const { params, resetParams } = useSearchParams();

  const resetFilters = useCallback(() => {
    const rollingAutomaticPeriod = resolveDashboardPeriod({ dateMode: "auto" });
    resetParams({
      team: params.team,
      dateMode: "auto",
      fromDate: rollingAutomaticPeriod.fromDate,
      toDate: rollingAutomaticPeriod.toDate,
      page: "1",
    });
  }, [params.team, resetParams]);

  return {
    hasActiveFilters: hasActiveDashboardFilters(params),
    hasActiveNonPeriodFilters: hasActiveNonPeriodFilters(params),
    resetFilters,
  };
}
