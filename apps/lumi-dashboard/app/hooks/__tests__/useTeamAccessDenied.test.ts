import { describe, expect, it } from "vitest";
import { getTeamAccessError } from "~/hooks/useTeamAccessDenied";
import { ApiErrorException, ErrorType } from "~/types/errors";

function apiError(status: number) {
  return new ApiErrorException({
    status,
    type: ErrorType.AUTHORIZATION_ERROR,
    message: "Melding fra API-et",
    timestamp: "2026-10-15T08:00:00Z",
  });
}

describe("getTeamAccessError", () => {
  it.each([401, 403, 503])("returns API errors with status %i", (status) => {
    const error = apiError(status);

    expect(getTeamAccessError(error)).toBe(error);
  });

  it.each([400, 404, 500])("ignores API errors with status %i", (status) => {
    expect(getTeamAccessError(apiError(status))).toBeUndefined();
  });

  it("ignores errors without the API's error shape", () => {
    expect(getTeamAccessError(new Error("403"))).toBeUndefined();
    expect(getTeamAccessError(null)).toBeUndefined();
  });
});
