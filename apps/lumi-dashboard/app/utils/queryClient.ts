import { QueryClient } from "@tanstack/react-query";
import { shouldRetryQuery } from "~/utils/queryRetry";

/** The dashboard's QueryClient, with the shared retry rule as the default. */
export function createDashboardQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        retry: shouldRetryQuery,
      },
    },
  });
}
