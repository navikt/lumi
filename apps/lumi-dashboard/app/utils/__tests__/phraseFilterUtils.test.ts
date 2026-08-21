import { describe, expect, it } from "vitest";

import {
  parsePhraseParam,
  stringifyPhraseFilter,
} from "~/utils/phraseFilterUtils";

describe("parsePhraseParam", () => {
  it("parses valid bigram phrase param", () => {
    expect(parsePhraseParam("comment:vanskelig forstå")).toEqual({
      fieldId: "comment",
      surface: "vanskelig forstå",
    });
  });

  it("returns null for single-word surface", () => {
    expect(parsePhraseParam("field-1:hello")).toBeNull();
  });

  it("preserves natural phrases with words between the content pair", () => {
    expect(parsePhraseParam("field:vanskelig å svare")).toEqual({
      fieldId: "field",
      surface: "vanskelig å svare",
    });
  });

  it("returns null for surface with colon", () => {
    expect(parsePhraseParam("field:with:colon")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parsePhraseParam(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePhraseParam("")).toBeNull();
  });

  it("returns null for missing colon", () => {
    expect(parsePhraseParam("no-colon-here")).toBeNull();
  });

  it("returns null for empty fieldId", () => {
    expect(parsePhraseParam(":surface")).toBeNull();
  });

  it("returns null for empty surface", () => {
    expect(parsePhraseParam("field:")).toBeNull();
  });

  it("returns null for unsafe or oversized field ids", () => {
    expect(parsePhraseParam("field$:vanskelig svare")).toBeNull();
    expect(parsePhraseParam(`${"a".repeat(201)}:vanskelig svare`)).toBeNull();
  });

  it("normalizes multiple consecutive spaces", () => {
    expect(parsePhraseParam("field:word1  word2")).toEqual({
      fieldId: "field",
      surface: "word1 word2",
    });
  });

  it("normalizes leading space", () => {
    expect(parsePhraseParam("field: word1 word2")).toEqual({
      fieldId: "field",
      surface: "word1 word2",
    });
  });

  it("normalizes trailing space", () => {
    expect(parsePhraseParam("field:word1 word2 ")).toEqual({
      fieldId: "field",
      surface: "word1 word2",
    });
  });

  it("roundtrips with stringifyPhraseFilter", () => {
    const fieldId = "comment-field";
    const surface = "vanskelig forstå";
    const raw = stringifyPhraseFilter(fieldId, surface);
    const result = parsePhraseParam(raw);
    expect(result).toEqual({ fieldId, surface });
  });
});

describe("stringifyPhraseFilter", () => {
  it("formats fieldId:surface", () => {
    expect(stringifyPhraseFilter("comment", "vanskelig forstå")).toBe(
      "comment:vanskelig forstå",
    );
  });
});
