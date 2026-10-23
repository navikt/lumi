import {
  Counter,
  type CounterConfiguration,
  register,
} from "@prometheus-io/client";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import {
  getResponseStatus,
  setResponseStatus,
} from "@tanstack/react-start/server";

import { logger } from "~/server/logger";
import {
  isServerFnHttpCall,
  serverFnFailureStatus,
} from "~/server/serverFnStatus";
import { ApiErrorException } from "~/types/errors";

// Only server code may import this module: it registers metrics when it loads.

export const SERVER_FN_FAILURES_METRIC =
  "lumi_dashboard_server_fn_failures_total";
export const SERVER_FN_5XX_FAILURES_METRIC =
  "lumi_dashboard_server_fn_5xx_failures_total";

// Vite's dev server can load the module again; the registry keeps the first.
function counter<T extends string>(
  configuration: CounterConfiguration<T>,
): Counter<T> {
  return (
    (register.getSingleMetric(configuration.name) as Counter<T> | undefined) ??
    new Counter(configuration)
  );
}

// The alert watches this one. It has no labels and exists with the value 0
// before the first failure, so increase() counts the first failures on a
// new pod too. A labelled series appears only at its first failure.
const serverFn5xxFailures = counter({
  name: SERVER_FN_5XX_FAILURES_METRIC,
  help: "Server function calls that threw and got a 5xx status",
});

const serverFnFailures = counter({
  name: SERVER_FN_FAILURES_METRIC,
  help: "Server function calls that threw, by server function and HTTP status",
  labelNames: ["fn", "status"] as const,
});

export interface ServerFnFailure {
  /** serverFnMeta.name: the variable name, so the label set stays small. */
  serverFn: string;
  durationMs: number;
}

/**
 * Handles a server function that threw. A call over HTTP gets the failure's
 * status, unless something already set an error status, such as
 * authMiddleware. A call made in-process during SSR leaves the page's status
 * alone. Both are logged and counted.
 *
 * Logs only names and numbers. Payloads and error messages can contain user
 * data and are never logged.
 */
export function reportServerFnFailure(
  error: unknown,
  { serverFn, durationMs }: ServerFnFailure,
): void {
  // Start answers these itself; they are not failures.
  if (isRedirect(error) || isNotFound(error) || error instanceof Response) {
    return;
  }

  const httpCall = isServerFnHttpCall();
  let status = serverFnFailureStatus(error);
  if (httpCall) {
    const currentStatus = getResponseStatus();
    if (currentStatus >= 400) {
      status = currentStatus;
    } else {
      setResponseStatus(status);
    }
  }

  serverFnFailures.inc({ fn: serverFn, status: String(status) });
  if (status >= 500) serverFn5xxFailures.inc();

  const fields = {
    serverFn,
    status,
    errorName: error instanceof Error ? error.name : typeof error,
    apiErrorType:
      error instanceof ApiErrorException ? error.error.type : undefined,
    durationMs: Math.round(durationMs),
    httpCall,
  };
  if (status >= 500) {
    logger.error(fields, "Server function failed");
  } else {
    logger.warn(fields, "Server function failed");
  }
}
