import { describe, expect, it } from "vitest";
import {
  isDraftConflictError,
  isRetryableSaveError,
} from "~/utils/surveyAuthoringErrors";

describe("isDraftConflictError", () => {
  it("recognizes the mock conflict message", () => {
    expect(
      isDraftConflictError(new Error("Draft changed since it was loaded")),
    ).toBe(true);
  });

  it("recognizes the API conflict message", () => {
    expect(
      isDraftConflictError(
        new Error("Draft changed since it was loaded. Reload before saving."),
      ),
    ).toBe(true);
  });

  it("treats other errors as non-conflicts", () => {
    expect(isDraftConflictError(new Error("fetch failed"))).toBe(false);
    expect(isDraftConflictError(new Error("Internal Server Error"))).toBe(
      false,
    );
    expect(isDraftConflictError("not an error")).toBe(false);
    expect(isDraftConflictError(undefined)).toBe(false);
  });
});

describe("isRetryableSaveError", () => {
  it("retries network-ish failures, 429 and 5xx", () => {
    expect(isRetryableSaveError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableSaveError(new Error("Request timed out"))).toBe(true);
    expect(isRetryableSaveError(new Error("503 Service Unavailable"))).toBe(
      true,
    );
    expect(isRetryableSaveError(new Error("Too Many Requests"))).toBe(true);
  });

  it("never retries permanent errors", () => {
    expect(isRetryableSaveError(new Error("Question 'x' needs a prompt"))).toBe(
      false,
    );
    expect(isRetryableSaveError(new Error("Survey project not found"))).toBe(
      false,
    );
    expect(isRetryableSaveError(new Error("Unauthorized"))).toBe(false);
    expect(
      isRetryableSaveError(new Error("Draft changed since it was loaded")),
    ).toBe(false);
    expect(isRetryableSaveError(undefined)).toBe(false);
  });
});
