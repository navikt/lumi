/**
 * A server function call that failed with an HTTP status before the server
 * function answered, as when the dashboard's CSRF check refuses the request
 * or a proxy answers with an error page. Only the status is kept: the body
 * is not read, so a slow or broken body cannot delay or hide the status.
 */
export class ServerFnHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerFnHttpError";
    this.status = status;
  }
}

/**
 * Fetch for a server function call that keeps the status of a failed answer
 * TanStack Start cannot read. Start reads a success, an answer from the
 * server function and JSON itself. For any other failed answer it throws an
 * error with only the body text, and the status is lost.
 */
export const fetchKeepingStatus: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok || isReadByStart(response.headers)) return response;
  void response.body?.cancel().catch(() => {});
  throw new ServerFnHttpError(response.status, `HTTP ${response.status}`);
};

function isReadByStart(headers: Headers) {
  return (
    headers.has("x-tss-serialized") ||
    headers.has("x-tss-raw") ||
    (headers.get("content-type") ?? "").includes("application/json")
  );
}
