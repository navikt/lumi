import { HttpStatusError } from "~/server/serverFnStatus";
import { LUMI_API_WRITE_TIMEOUT_MESSAGE } from "~/utils/apiErrorMessages";

export const LUMI_API_TIMEOUT_MS = 30_000;
export const LUMI_API_LONG_TIMEOUT_MS = 150_000;

export class LumiApiTimeoutError extends HttpStatusError {
  constructor(method = "GET") {
    const read =
      method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
    super(
      504,
      read
        ? "Lumi API brukte for lang tid. Prøv igjen om litt."
        : LUMI_API_WRITE_TIMEOUT_MESSAGE,
    );
    this.name = "LumiApiTimeoutError";
  }
}

/**
 * Lumi API returns bounded JSON or downloads. Read the body within the same
 * deadline as the headers, so a slow body cannot leave a server function
 * waiting indefinitely. Callers keep their existing status/body handling.
 */
export async function lumiApiFetch(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = LUMI_API_TIMEOUT_MS,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  try {
    const response = await fetch(input, { ...init, signal });
    const body = response.body === null ? null : await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (timeout.aborted && signal.reason === timeout.reason) {
      throw new LumiApiTimeoutError(init.method);
    }
    throw error;
  }
}
