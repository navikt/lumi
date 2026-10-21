import { isNotFound } from "@tanstack/react-router";

import { logger } from "~/server/logger";

/**
 * Logs an error that escapes a server function. TanStack Start stopped
 * logging these itself in 1.169, so without this they never reach the logs.
 * Redirects, other responses and not-found errors are control flow, not
 * failures, and Start skipped them as well.
 */
export function logServerFnError(error: unknown, serverFn: string): void {
  if (error instanceof Response || isNotFound(error)) return;

  logger.error({ err: error, serverFn }, "Server function failed");
}
