import { describe, expect, it } from "vitest";
import { LumiApiTimeoutError } from "~/server/lumiApiFetch";
import { ApiErrorException, ErrorType } from "~/types/errors";
import type { SurveyAuthoringProject } from "~/types/surveyAuthoring";
import {
  LUMI_API_WRITE_TIMEOUT_MESSAGE,
  UNREADABLE_WRITE_ANSWER_MESSAGE,
} from "~/utils/apiErrorMessages";
import { ServerFnHttpError } from "~/utils/serverFnFetch";
import {
  isDraftConflictError,
  isRetryable,
  isTransientFetchError,
  PresentationNotSavedError,
  type SaveFailure,
  saveFailureOf,
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

describe("saveFailureOf", () => {
  const saved = {
    id: "p1",
    team: "team-a",
    name: "Utkast",
    surveyId: "survey-1",
    document: { authoringSchemaVersion: 1 as const, pages: [] },
    presentation: { mode: "dock" as const, placementNote: null },
    draftVersion: 4,
    createdAt: "2026-11-24T10:00:00Z",
    updatedAt: "2026-11-24T10:00:00Z",
  } as unknown as SurveyAuthoringProject;

  it.each<[string, unknown, SaveFailure]>([
    [
      "a newer draft on the server",
      new Error("Draft changed since it was loaded"),
      "conflict",
    ],
    [
      "a save that took too long",
      new Error(LUMI_API_WRITE_TIMEOUT_MESSAGE),
      "uncertain",
    ],
    [
      "an answer that is not the draft",
      new Error(UNREADABLE_WRITE_ANSWER_MESSAGE),
      "uncertain",
    ],
    [
      "a draft saved without its display choice",
      new PresentationNotSavedError(saved),
      "partial",
    ],
    ["a broken connection", new Error("fetch failed"), "unknown"],
    [
      "a browser that lost the request",
      new Error("Failed to fetch"),
      "unknown",
    ],
    [
      "a connection that broke while the answer was read",
      new Error("terminated"),
      "unknown",
    ],
    ["a request that timed out", new Error("Request timed out"), "unknown"],
    [
      "a failing gateway",
      new Error("Backend request failed: 502 Bad Gateway"),
      "unknown",
    ],
    ["a failing API", new Error("Internal server error"), "unknown"],
    [
      "a status first in the message",
      new Error("503 Service Unavailable"),
      "unknown",
    ],
    ["too many requests", new Error("Too many requests"), "refused"],
    [
      "a refusal that also names the network",
      new Error("Too many requests from this network"),
      "refused",
    ],
    [
      "too many requests at a gateway",
      new Error("Backend request failed: 429 Too Many Requests"),
      "refused",
    ],
    [
      "an error in the draft",
      new Error("Question 'x' needs a prompt"),
      "rejected",
    ],
    ["a missing draft", new Error("Survey project not found"), "rejected"],
    [
      "a limit with a number like a status",
      new Error("Too big: expected string to have <=500 characters"),
      "rejected",
    ],
    [
      "a Norwegian limit",
      new Error("Spørsmålet kan ha høyst 500 tegn"),
      "rejected",
    ],
    ["something that is not an error", "nettverk", "rejected"],
  ])("reads %s", (_case, error, failure) => {
    expect(saveFailureOf(error)).toBe(failure);
  });

  it("says that another try can save the draft only where it can", () => {
    expect(
      (
        [
          "conflict",
          "uncertain",
          "partial",
          "unknown",
          "refused",
          "rejected",
        ] as const
      ).filter(isRetryable),
    ).toEqual(["partial", "unknown", "refused"]);
  });

  it("keeps what the server saved when only the display choice was left out", () => {
    const error = new PresentationNotSavedError(saved);
    expect(error.saved.draftVersion).toBe(4);
    expect(error.message).toBe(
      "Visningsvalget ble ikke lagret. Resten av utkastet er lagret. Prøv igjen om litt.",
    );
  });
});

describe("isTransientFetchError", () => {
  const apiError = (status: number) =>
    new ApiErrorException({
      status,
      type: ErrorType.INTERNAL_SERVER_ERROR,
      message: "Feil",
      timestamp: "2026-11-24T10:00:00Z",
    });

  it.each<[string, unknown, boolean]>([
    ["a server error from Lumi API", apiError(503), true],
    ["too many requests to Lumi API", apiError(429), true],
    ["a refusal from Lumi API", apiError(403), false],
    ["a request Lumi API rejects", apiError(400), false],
    [
      "an error page before the server function",
      new ServerFnHttpError(500, "Feil"),
      true,
    ],
    [
      "too many requests before the server function",
      new ServerFnHttpError(429, ""),
      true,
    ],
    [
      "a refusal before the server function, whatever its text says",
      new ServerFnHttpError(403, "Network policy"),
      false,
    ],
    ["a refusal with plain text and no status", new Error("Forbidden"), false],
    [
      // Only the message of the dashboard's timeout reaches the browser.
      "a read from Lumi API that timed out",
      new Error(new LumiApiTimeoutError("GET").message),
      true,
    ],
    [
      "an answer that is not the draft",
      new Error("Svaret er ikke utkastet"),
      false,
    ],
  ])("reads %s", (_case, error, transient) => {
    expect(isTransientFetchError(error)).toBe(transient);
  });
});
