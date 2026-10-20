import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LumiSurveyHttpError } from "../httpError.js";
import {
  getRetryDelayMs,
  SUBMIT_TIMEOUT_MS,
  submitWithRetry,
} from "../submitWithRetry.js";
import type {
  LumiSurveySubmission,
  LumiSurveyTransport,
  LumiSurveyTransportOptions,
} from "../types.js";

const submission = {
  surveyId: "survey-1",
  answers: {},
  startedAt: "2026-10-20T12:00:00Z",
  submittedAt: "2026-10-20T12:01:00Z",
  transportPayload: { deduplicationKey: "key-1" },
} as unknown as LumiSurveySubmission;

function transportWith(
  ...results: Array<"ok" | unknown>
): LumiSurveyTransport & { submit: ReturnType<typeof vi.fn> } {
  const submit = vi.fn();
  for (const result of results) {
    if (result === "ok") submit.mockResolvedValueOnce(undefined);
    else submit.mockRejectedValueOnce(result);
  }
  return { submit };
}

describe("submitWithRetry", () => {
  const wait = vi.fn(async (_ms: number) => {});

  beforeEach(() => {
    wait.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends once and passes an abort signal to the transport", async () => {
    const transport = transportWith("ok");

    await submitWithRetry(transport, submission, { wait });

    expect(transport.submit).toHaveBeenCalledTimes(1);
    const [sent, options] = transport.submit.mock.calls[0] as [
      LumiSurveySubmission,
      LumiSurveyTransportOptions,
    ];
    expect(sent).toBe(submission);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });

  it("tries once more with the same submission after a 503", async () => {
    const transport = transportWith(new LumiSurveyHttpError(503), "ok");

    await submitWithRetry(transport, submission, { wait });

    expect(wait).toHaveBeenCalledWith(1_000);
    expect(transport.submit).toHaveBeenCalledTimes(2);
    expect(transport.submit.mock.calls[1]?.[0]).toBe(submission);
  });

  it("waits as long as Retry-After asks on a 429", async () => {
    const transport = transportWith(
      new LumiSurveyHttpError(429, { retryAfter: "2" }),
      "ok",
    );

    await submitWithRetry(transport, submission, { wait });

    expect(wait).toHaveBeenCalledWith(2_000);
    expect(transport.submit).toHaveBeenCalledTimes(2);
  });

  it("gives up at once when Retry-After asks for more than five seconds", async () => {
    const rateLimited = new LumiSurveyHttpError(429, { retryAfter: "30" });
    const transport = transportWith(rateLimited);

    await expect(submitWithRetry(transport, submission, { wait })).rejects.toBe(
      rateLimited,
    );
    expect(transport.submit).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("tries only once more and then shows the last error", async () => {
    const second = new LumiSurveyHttpError(503);
    const transport = transportWith(new LumiSurveyHttpError(503), second);

    await expect(submitWithRetry(transport, submission, { wait })).rejects.toBe(
      second,
    );
    expect(transport.submit).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a 400", new LumiSurveyHttpError(400)],
    ["a 500", new LumiSurveyHttpError(500)],
    ["an error without status", new Error("Innsending feilet med status 503")],
  ])("does not retry %s", async (_name, error) => {
    const transport = transportWith(error);

    await expect(submitWithRetry(transport, submission, { wait })).rejects.toBe(
      error,
    );
    expect(transport.submit).toHaveBeenCalledTimes(1);
  });

  it("stops waiting after the timeout and aborts the signal", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const transport: LumiSurveyTransport = {
      submit: (_submission, options) => {
        signal = options?.signal;
        return new Promise<void>(() => {});
      },
    };

    const result = submitWithRetry(transport, submission, { wait });
    const settled = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
    await settled;

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toMatchObject({ name: "TimeoutError" });
    expect(wait).not.toHaveBeenCalled();
  });

  it("turns a transport that throws synchronously into a rejection", async () => {
    const failure = new Error("Ugyldig konfigurasjon");
    const transport: LumiSurveyTransport = {
      submit: () => {
        throw failure;
      },
    };

    await expect(submitWithRetry(transport, submission, { wait })).rejects.toBe(
      failure,
    );
  });
});

describe("getRetryDelayMs", () => {
  it("reads status and Retry-After from any thrown object", () => {
    expect(getRetryDelayMs({ status: 503 })).toBe(1_000);
    expect(getRetryDelayMs({ status: 429, retryAfterSeconds: 0 })).toBe(0);
    expect(getRetryDelayMs({ status: 503, retryAfterSeconds: 5 })).toBe(5_000);
  });

  it("does not retry other statuses or values without a numeric status", () => {
    expect(getRetryDelayMs({ status: 504 })).toBeUndefined();
    expect(getRetryDelayMs({ status: "503" })).toBeUndefined();
    expect(getRetryDelayMs(undefined)).toBeUndefined();
    expect(getRetryDelayMs("503")).toBeUndefined();
  });

  it("falls back to one second for an unusable Retry-After", () => {
    expect(getRetryDelayMs({ status: 503, retryAfterSeconds: -1 })).toBe(1_000);
    expect(
      getRetryDelayMs({ status: 503, retryAfterSeconds: Number.NaN }),
    ).toBe(1_000);
  });
});
