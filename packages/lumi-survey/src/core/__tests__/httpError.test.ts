import { describe, expect, it } from "vitest";
import { LumiSurveyHttpError, parseRetryAfter } from "../httpError.js";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("parseRetryAfter", () => {
  it("reads delay seconds", () => {
    expect(parseRetryAfter("0", NOW)).toBe(0);
    expect(parseRetryAfter(" 3 ", NOW)).toBe(3);
  });

  it("reads an HTTP date as seconds from now, never below zero", () => {
    expect(parseRetryAfter("Tue, 20 Oct 2026 12:00:05 GMT", NOW)).toBe(5);
    expect(parseRetryAfter("Tue, 20 Oct 2026 11:59:00 GMT", NOW)).toBe(0);
  });

  it("ignores a missing or invalid value", () => {
    expect(parseRetryAfter(null, NOW)).toBeUndefined();
    expect(parseRetryAfter(undefined, NOW)).toBeUndefined();
    expect(parseRetryAfter("", NOW)).toBeUndefined();
    expect(parseRetryAfter("-1", NOW)).toBeUndefined();
    expect(parseRetryAfter("1.5", NOW)).toBeUndefined();
    expect(parseRetryAfter("snart", NOW)).toBeUndefined();
  });
});

describe("LumiSurveyHttpError", () => {
  it("keeps the status and Retry-After from a response", () => {
    const error = LumiSurveyHttpError.fromResponse(
      new Response(null, { status: 503, headers: { "Retry-After": "2" } }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("LumiSurveyHttpError");
    expect(error.status).toBe(503);
    expect(error.retryAfterSeconds).toBe(2);
    expect(error.message).toBe("Lumi: Submission failed with status 503");
  });

  it("has no Retry-After when the response lacks one", () => {
    const error = LumiSurveyHttpError.fromResponse(
      new Response(null, { status: 429 }),
    );

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBeUndefined();
  });
});
