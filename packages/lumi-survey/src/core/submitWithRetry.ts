import type { LumiSurveySubmission, LumiSurveyTransport } from "./types";

/**
 * How long the widget waits for one attempt. The example backend routes give
 * up on Lumi API after 8 seconds, so their 504 normally arrives first.
 */
export const SUBMIT_TIMEOUT_MS = 10_000;

const MAX_RETRY_DELAY_MS = 5_000;
// Without Retry-After, a 503 is retried after 0.5–1.5 s. The spread keeps
// widgets that failed together from retrying in the same instant.
const MIN_DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_RETRY_DELAY_SPREAD_MS = 1_000;

export interface SubmitWithRetryOptions {
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * Sends the submission, and once more with the same submission and
 * deduplication key when Lumi API answered 503, or 429 with a short
 * Retry-After. Lumi API stores a repeated deduplication key only once, so a
 * retry after an attempt that did reach the database is safe.
 */
export async function submitWithRetry(
  transport: LumiSurveyTransport,
  submission: LumiSurveySubmission,
  {
    timeoutMs = SUBMIT_TIMEOUT_MS,
    wait = delay,
    random = Math.random,
  }: SubmitWithRetryOptions = {},
): Promise<void> {
  try {
    await submitOnce(transport, submission, timeoutMs);
  } catch (cause) {
    const retryDelayMs = getRetryDelayMs(cause, random);
    if (retryDelayMs === undefined) throw cause;
    await wait(retryDelayMs);
    await submitOnce(transport, submission, timeoutMs);
  }
}

/**
 * Waits for one attempt for at most `timeoutMs`. The signal tells a transport
 * that passes it on to `fetch` to cancel the request as well.
 */
function submitOnce(
  transport: LumiSurveyTransport,
  submission: LumiSurveySubmission,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeout = new DOMException(
        `Lumi: Submission did not finish within ${timeoutMs} ms`,
        "TimeoutError",
      );
      controller.abort(timeout);
      reject(timeout);
    }, timeoutMs);

    Promise.resolve()
      .then(() => transport.submit(submission, { signal: controller.signal }))
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Milliseconds to wait before the one automatic retry, or undefined when the
 * error should be shown instead. Reads `status` and `retryAfterSeconds` from
 * any thrown object, so transports with their own error type can opt in.
 *
 * - 503: retry after Retry-After, or after 0.5–1.5 s without it.
 * - 429: retry only when Retry-After asks for a short wait. The rate limits in
 *   Lumi API last a minute, so a retry without it would only be rejected again.
 */
export function getRetryDelayMs(
  cause: unknown,
  random: () => number = Math.random,
): number | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;

  const { status, retryAfterSeconds } = cause as {
    status?: unknown;
    retryAfterSeconds?: unknown;
  };
  const retryAfterMs =
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
      ? retryAfterSeconds * 1000
      : undefined;

  let delayMs: number | undefined;
  if (status === 503) {
    delayMs =
      retryAfterMs ??
      MIN_DEFAULT_RETRY_DELAY_MS +
        Math.round(random() * DEFAULT_RETRY_DELAY_SPREAD_MS);
  } else if (status === 429) {
    delayMs = retryAfterMs;
  }

  return delayMs !== undefined && delayMs <= MAX_RETRY_DELAY_MS
    ? delayMs
    : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
