import { describe, expect, it } from "vitest";
import { LUMI_API_WRITE_TIMEOUT_MESSAGE } from "~/utils/apiErrorMessages";
import {
  isPublicDemoReadOnlyError,
  PUBLIC_DEMO_READ_ONLY_MESSAGE,
  PUBLIC_DEMO_READ_ONLY_TEXT,
  writeErrorText,
} from "~/utils/publicDemo";
import { isRetryableSaveError } from "~/utils/surveyAuthoringErrors";

const refusal = new Error(PUBLIC_DEMO_READ_ONLY_MESSAGE);

describe("isPublicDemoReadOnlyError", () => {
  it("recognizes the demo refusal after it crosses the server boundary", () => {
    expect(isPublicDemoReadOnlyError(refusal)).toBe(true);
  });

  it("treats other errors as ordinary failures", () => {
    expect(isPublicDemoReadOnlyError(new Error("Marker not found"))).toBe(
      false,
    );
    expect(isPublicDemoReadOnlyError(PUBLIC_DEMO_READ_ONLY_MESSAGE)).toBe(
      false,
    );
    expect(isPublicDemoReadOnlyError(undefined)).toBe(false);
  });
});

describe("writeErrorText", () => {
  it("keeps an uncertain write outcome after serialization and does not retry automatically", () => {
    const error = new Error(LUMI_API_WRITE_TIMEOUT_MESSAGE);
    expect(
      writeErrorText(error, "Endringen ble ikke lagret. Prøv igjen."),
    ).toBe(LUMI_API_WRITE_TIMEOUT_MESSAGE);
    expect(isRetryableSaveError(error)).toBe(false);
  });

  it("does not pass through arbitrary details appended to a known timeout message", () => {
    const error = new Error(
      `${LUMI_API_WRITE_TIMEOUT_MESSAGE} private response`,
    );
    expect(writeErrorText(error, "Noe gikk galt.")).toBe("Noe gikk galt.");
  });

  it("explains the demo refusal instead of asking for a retry", () => {
    expect(writeErrorText(refusal, "Noe gikk galt. Prøv igjen.")).toBe(
      PUBLIC_DEMO_READ_ONLY_TEXT,
    );
  });

  it("keeps the view's own message for other failures", () => {
    expect(
      writeErrorText(new Error("fetch failed"), "Noe gikk galt. Prøv igjen."),
    ).toBe("Noe gikk galt. Prøv igjen.");
  });

  it("is never retried as a transient save error", () => {
    expect(isRetryableSaveError(refusal)).toBe(false);
  });
});
