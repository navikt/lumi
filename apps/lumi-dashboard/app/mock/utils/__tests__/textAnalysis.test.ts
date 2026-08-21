import { describe, expect, it } from "vitest";

import { matchesThemeKeywords } from "~/mock/utils/textAnalysis";

describe("matchesThemeKeywords", () => {
  it("matches a multi-word keyword inside one text segment", () => {
    expect(
      matchesThemeKeywords("Jeg ble logget ut av løsningen", ["logget ut"]),
    ).toBe(true);
  });

  it("does not match across sentence boundaries or inside redaction markers", () => {
    expect(matchesThemeKeywords("Jeg logget. Ut igjen", ["logget ut"])).toBe(
      false,
    );
    expect(matchesThemeKeywords("[LOGGET UT] igjen", ["logget ut"])).toBe(
      false,
    );
    expect(
      matchesThemeKeywords("Jeg fant [PERSON FJERNET] ikke siden", [
        "fant ikke",
      ]),
    ).toBe(false);
  });
});
