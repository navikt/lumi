import { describe, expect, it } from "vitest";
import { ApiErrorException, ErrorType } from "~/types/errors";
import { shouldRetryQuery } from "../queryRetry";

function apiError(status: number, type: ErrorType) {
  return new ApiErrorException({
    status,
    type,
    message: "Melding fra API-et",
    timestamp: "2026-10-20T08:00:00Z",
  });
}

describe("shouldRetryQuery", () => {
  it("does not retry a 4xx answer from the API", () => {
    expect(
      shouldRetryQuery(0, apiError(401, ErrorType.AUTHENTICATION_ERROR)),
    ).toBe(false);
    expect(
      shouldRetryQuery(0, apiError(403, ErrorType.AUTHORIZATION_ERROR)),
    ).toBe(false);
    expect(shouldRetryQuery(0, apiError(429, ErrorType.RATE_LIMITED))).toBe(
      false,
    );
  });

  it("does not retry when the database is unavailable", () => {
    expect(
      shouldRetryQuery(0, apiError(503, ErrorType.DATABASE_UNAVAILABLE)),
    ).toBe(false);
  });

  it("retries other 503 answers and unexpected errors once", () => {
    const teamLookupFailed = apiError(503, ErrorType.INTERNAL_SERVER_ERROR);

    expect(shouldRetryQuery(0, teamLookupFailed)).toBe(true);
    expect(shouldRetryQuery(1, teamLookupFailed)).toBe(false);
    expect(
      shouldRetryQuery(0, apiError(500, ErrorType.INTERNAL_SERVER_ERROR)),
    ).toBe(true);
    expect(
      shouldRetryQuery(0, new Error("Backend request failed: 502 Bad Gateway")),
    ).toBe(true);
    expect(
      shouldRetryQuery(1, new Error("Backend request failed: 502 Bad Gateway")),
    ).toBe(false);
  });
});
