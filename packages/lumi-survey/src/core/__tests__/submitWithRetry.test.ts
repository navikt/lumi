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

function signalOf(
  transport: { submit: ReturnType<typeof vi.fn> },
  call: number,
): AbortSignal {
  const options = transport.submit.mock.calls[call]?.[1] as
    | LumiSurveyTransportOptions
    | undefined;
  if (!options) throw new Error(`No options for call ${call}`);
  return options.signal;
}

const middleOfSpread = () => 0.5;

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
    expect(transport.submit.mock.calls[0]?.[0]).toBe(submission);
    expect(signalOf(transport, 0)).toBeInstanceOf(AbortSignal);
    expect(signalOf(transport, 0).aborted).toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });

  it("tries once more with the same submission and a fresh signal after a 503", async () => {
    const transport = transportWith(new LumiSurveyHttpError(503), "ok");

    await submitWithRetry(transport, submission, {
      wait,
      random: middleOfSpread,
    });

    expect(wait).toHaveBeenCalledWith(1_000);
    expect(transport.submit).toHaveBeenCalledTimes(2);
    expect(transport.submit.mock.calls[1]?.[0]).toBe(submission);
    expect(signalOf(transport, 1)).not.toBe(signalOf(transport, 0));
    expect(signalOf(transport, 1).aborted).toBe(false);
  });

  it("spreads the retry after a 503 between half a second and one and a half", async () => {
    await submitWithRetry(
      transportWith(new LumiSurveyHttpError(503), "ok"),
      submission,
      { wait, random: () => 0 },
    );
    await submitWithRetry(
      transportWith(new LumiSurveyHttpError(503), "ok"),
      submission,
      { wait, random: () => 0.999 },
    );

    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([500, 1_499]);
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

  it.each([
    ["a 429 without Retry-After", new LumiSurveyHttpError(429)],
    [
      "a 429 that asks for more than five seconds",
      new LumiSurveyHttpError(429, { retryAfter: "30" }),
    ],
    [
      "a 503 that asks for more than five seconds",
      new LumiSurveyHttpError(503, { retryAfter: "6" }),
    ],
    ["a 400", new LumiSurveyHttpError(400)],
    ["a 500", new LumiSurveyHttpError(500)],
    ["an error without status", new Error("Innsending feilet med status 503")],
  ])("shows the error at once after %s", async (_name, error) => {
    const transport = transportWith(error);

    await expect(submitWithRetry(transport, submission, { wait })).rejects.toBe(
      error,
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

  it("stops waiting after the timeout, aborts the signal and leaves no timers", async () => {
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
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives the retry its own timeout", async () => {
    vi.useFakeTimers();
    const submit = vi
      .fn<LumiSurveyTransport["submit"]>()
      .mockRejectedValueOnce(new LumiSurveyHttpError(503))
      .mockReturnValueOnce(new Promise<void>(() => {}));

    const result = submitWithRetry({ submit }, submission, {
      random: middleOfSpread,
    });
    const settled = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(submit).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
    await settled;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry before the delay has passed", async () => {
    vi.useFakeTimers();
    const submit = vi
      .fn<LumiSurveyTransport["submit"]>()
      .mockRejectedValueOnce(new LumiSurveyHttpError(503))
      .mockResolvedValueOnce(undefined);

    const result = submitWithRetry({ submit }, submission, {
      random: middleOfSpread,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(submit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await result;

    expect(submit).toHaveBeenCalledTimes(2);
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
    expect(getRetryDelayMs({ status: 503 }, middleOfSpread)).toBe(1_000);
    expect(getRetryDelayMs({ status: 429, retryAfterSeconds: 0 })).toBe(0);
    expect(getRetryDelayMs({ status: 503, retryAfterSeconds: 5 })).toBe(5_000);
  });

  it("does not retry other statuses or values without a numeric status", () => {
    expect(getRetryDelayMs({ status: 504 })).toBeUndefined();
    expect(getRetryDelayMs({ status: "503" })).toBeUndefined();
    expect(getRetryDelayMs({ status: 429 })).toBeUndefined();
    expect(getRetryDelayMs(undefined)).toBeUndefined();
    expect(getRetryDelayMs("503")).toBeUndefined();
  });

  it("ignores an unusable Retry-After", () => {
    expect(
      getRetryDelayMs({ status: 503, retryAfterSeconds: -1 }, middleOfSpread),
    ).toBe(1_000);
    expect(
      getRetryDelayMs(
        { status: 503, retryAfterSeconds: Number.NaN },
        middleOfSpread,
      ),
    ).toBe(1_000);
    expect(
      getRetryDelayMs({ status: 429, retryAfterSeconds: Number.NaN }),
    ).toBeUndefined();
  });
});
