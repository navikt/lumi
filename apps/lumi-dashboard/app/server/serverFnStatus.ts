import { getGlobalStartContext } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { ApiErrorException } from "~/types/errors";

/**
 * A failure that stands for an HTTP status, such as a missing login. Like any
 * other Error, it reaches the browser as a plain Error with the same message.
 */
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/**
 * Lumi API answered with something the dashboard cannot use: an error
 * without Lumi API's error format, or an answer that breaks the contract.
 */
export class BadGatewayError extends HttpStatusError {
  constructor(message: string) {
    super(502, message);
    this.name = "BadGatewayError";
  }
}

/**
 * The error for a failed answer from Lumi API that the dashboard passes on
 * with its own message. A 4xx is about the viewer and keeps its status. A
 * 5xx becomes 502, because the dashboard is the gateway.
 */
export function apiStatusError(
  status: number,
  message: string,
): HttpStatusError {
  return status >= 500
    ? new BadGatewayError(message)
    : new HttpStatusError(status, message);
}

/**
 * True when Start handles the current request as a call to a server function
 * over HTTP. securityHeadersMiddleware in start.ts copies Start's own
 * handlerType into the global context. A page that runs a server function
 * in-process during SSR has the page's context, where the flag is false, and
 * a status set there would become the status of the page.
 */
export function isServerFnHttpCall(): boolean {
  try {
    return getGlobalStartContext()?.serverFnHttpCall === true;
  } catch {
    // Outside a request there is no response to give a status.
    return false;
  }
}

/**
 * Sets the response status for a server function called over HTTP. During
 * SSR the page keeps its own status. Returns whether the status was set.
 */
export function setServerFnHttpStatus(status: number): boolean {
  if (!isServerFnHttpCall()) return false;
  setResponseStatus(status);
  return true;
}

/**
 * The HTTP status a failed server function stands for. The browser decodes
 * the reply by its headers, not by its status, so the status changes logs,
 * metrics and access logs, not what the page shows.
 */
export function serverFnFailureStatus(error: unknown): number {
  if (error instanceof ApiErrorException) {
    return httpErrorStatus(error.error.status) ?? 500;
  }
  const ownStatus = httpErrorStatus(statusOf(error));
  if (ownStatus !== undefined) return ownStatus;
  if (isInvalidInput(error)) return 400;
  if (isUnreachable(error)) return 502;
  return 500;
}

function httpErrorStatus(status: number | undefined): number | undefined {
  return status !== undefined &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
    ? status
    : undefined;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return typeof error.status === "number" ? error.status : undefined;
}

/**
 * The input failed the schema in `.validator()`. Start then throws a plain
 * Error whose message is the JSON list of issues, and sets no other marker.
 * Answers from Lumi API are parsed with parseApiAnswer, which throws
 * BadGatewayError, so a subclass of Error never counts as invalid input.
 */
function isInvalidInput(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    Object.getPrototypeOf(error) !== Error.prototype ||
    !error.message.startsWith("[")
  ) {
    return false;
  }
  let issues: unknown;
  try {
    issues = JSON.parse(error.message);
  } catch {
    return false;
  }
  return (
    Array.isArray(issues) && issues.length > 0 && issues.every(isSchemaIssue)
  );
}

function isSchemaIssue(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const issue = value as { message?: unknown; path?: unknown };
  return (
    typeof issue.message === "string" &&
    (issue.path === undefined || Array.isArray(issue.path))
  );
}

/**
 * fetch in Node rejects with TypeError("fetch failed") when it cannot reach
 * Lumi API, and with TypeError("terminated") when the connection breaks while
 * the body is read.
 */
function isUnreachable(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message === "fetch failed" || error.message === "terminated")
  );
}
