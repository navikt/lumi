import type { LumiSurveySubmission, LumiSurveyTransport } from "./types";

/**
 * How long the widget waits for one attempt. The example backend routes give
 * up on Lumi API after 8 seconds, so their 504 normally arrives first.
 */
export const SUBMIT_TIMEOUT_MS = 10_000;

const RETRY_STATUSES = new Set([429, 503]);
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5_000;

export interface SubmitWithRetryOptions {
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Sends the submission, and once more with the same submission and
 * deduplication key when Lumi API answered 429 or 503 and asked for at most a
 * short wait. Lumi API stores a repeated deduplication key only once, so a
 * retry after an attempt that did reach the database is safe.
 */
export async function submitWithRetry(
  transport: LumiSurveyTransport,
  submission: LumiSurveySubmission,
  { timeoutMs = SUBMIT_TIMEOUT_MS, wait = delay }: SubmitWithRetryOptions = {},
): Promise<void> {
  try {
    await submitOnce(transport, submission, timeoutMs);
  } catch (cause) {
    const retryDelayMs = getRetryDelayMs(cause);
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
 */
export function getRetryDelayMs(cause: unknown): number | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;

  const { status, retryAfterSeconds } = cause as {
    status?: unknown;
    retryAfterSeconds?: unknown;
  };
  if (typeof status !== "number" || !RETRY_STATUSES.has(status)) {
    return undefined;
  }

  const delayMs =
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
      ? retryAfterSeconds * 1000
      : DEFAULT_RETRY_DELAY_MS;
  return delayMs <= MAX_RETRY_DELAY_MS ? delayMs : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
