import { type Query, QueryClient } from "@tanstack/react-query";
import { isAnalysisBudgetError } from "~/utils/analysisBudget";
import { shouldRetryQuery } from "~/utils/queryRetry";

/**
 * The API gives the same answer to an analysis with too many answers each
 * time. Fetching it again on focus, on reconnect or for a new observer only
 * hides the alert for a moment, and costs the API the same queries. A
 * component that switches back to such a query still fetches it again.
 */
function unlessAnalysisBudget(query: Query): boolean {
  return !isAnalysisBudgetError(query.state.error);
}

/** The dashboard's QueryClient, with the shared retry rule as the default. */
export function createDashboardQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        retry: shouldRetryQuery,
        refetchOnWindowFocus: unlessAnalysisBudget,
        refetchOnReconnect: unlessAnalysisBudget,
        refetchOnMount: unlessAnalysisBudget,
        retryOnMount: unlessAnalysisBudget,
      },
    },
  });
}
