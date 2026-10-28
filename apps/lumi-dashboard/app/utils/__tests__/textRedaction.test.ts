import { describe, expect, it } from "vitest";
import {
  mergeRedactionRanges,
  RedactFeedbackSchema,
  redactTextPreview,
  storedTextSelection,
} from "../textRedaction";

describe("text selections for permanent masking", () => {
  it("maps normalized textarea line endings back to the original stored text", () => {
    const text = "Takk!\r\n🙂\r\nMvh Ola\rResten";
    const displayed = text.replace(/\r\n?/g, "\n");
    const start = displayed.indexOf("Ola");
    const range = storedTextSelection(text, start, start + 3);
    expect(range).toEqual({
      start: text.indexOf("Ola"),
      end: text.indexOf("Ola") + 3,
    });
    if (!range) throw new Error("Expected a stored selection");
    expect(redactTextPreview(text, [range])).toBe(
      "Takk!\r\n🙂\r\nMvh [TEKST FJERNET]\rResten",
    );
    expect(storedTextSelection("a\r\nb", 1, 2)).toEqual({ start: 1, end: 3 });
    expect(storedTextSelection(text, 1, 1)).toBeNull();
  });
  it("preserves the rest of the answer, repeated words and emoji", () => {
    const text = "🙂 Ola fikk hjelp. Mvh Ola";
    expect(
      redactTextPreview(text, [
        { start: text.lastIndexOf("Ola"), end: text.length },
      ]),
    ).toBe("🙂 Ola fikk hjelp. Mvh [TEKST FJERNET]");
  });
  it("merges overlapping and adjacent selections using original offsets", () => {
    const ranges = [
      { start: 4, end: 7 },
      { start: 1, end: 5 },
      { start: 7, end: 9 },
    ];
    expect(mergeRedactionRanges("0123456789", ranges)).toEqual([
      { start: 1, end: 9 },
    ]);
    expect(ranges[0]).toEqual({ start: 4, end: 7 });
    expect(
      redactTextPreview(
        "0123456789",
        mergeRedactionRanges("0123456789", ranges),
      ),
    ).toBe("0[TEKST FJERNET]9");
  });
  it("refuses out-of-range and split-surrogate selections", () => {
    for (const range of [
      { start: -1, end: 1 },
      { start: 0, end: 99 },
      { start: 1, end: 2 },
      { start: 0, end: 1 },
      { start: 2, end: 2 },
    ]) {
      expect(() => mergeRedactionRanges("🙂 Ola", [range])).toThrow();
    }
  });
  it("requires an explicit team, fingerprint and bounded selection list", () => {
    const valid = {
      id: "id",
      team: "team",
      fieldId: "text",
      expectedTextHash: "a".repeat(64),
      ranges: [{ start: 0, end: 3 }],
    };
    expect(RedactFeedbackSchema.safeParse(valid).success).toBe(true);
    for (const override of [
      { team: "" },
      { expectedTextHash: "original text" },
      { ranges: [] },
      { ranges: Array(21).fill(valid.ranges[0]) },
    ]) {
      expect(
        RedactFeedbackSchema.safeParse({ ...valid, ...override }).success,
      ).toBe(false);
    }
  });
});
