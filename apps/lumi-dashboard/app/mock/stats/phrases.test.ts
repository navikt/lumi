import { describe, expect, it } from "vitest";

import {
  extractPhrases,
  extractStemmedBigrams,
  extractTopKeywords,
  textMatchesPhrase,
} from "./phrases";

describe("mock phrase analysis", () => {
  it("groups on content words while preserving natural display text", () => {
    const result = extractPhrases([
      {
        id: "first",
        text: "Det er vanskelig å svare raskt",
        submittedAt: "2026-01-01T10:00:00Z",
      },
      {
        id: "second",
        text: "Dette var vanskelige svaret å gi",
        submittedAt: "2026-01-02T10:00:00Z",
      },
    ]);

    expect(result.phrases).toContainEqual({
      text: "vanskelig å svare",
      count: 2,
      sourceResponseIds: ["first", "second"],
    });
    expect(
      textMatchesPhrase("Dette var vanskelige svaret", "vanskelig å svare"),
    ).toBe(true);
  });

  it("collapses word chains but keeps unrelated findings from the same answers", () => {
    const result = extractPhrases(
      [
        "Usikker på om endringene mine ble lagret. Kontakte NAV er vanskelig",
        "Usikker på om endringene mine ble lagret. Kontakte NAV er vanskelig",
      ].map((text, index) => ({
        id: `same-source-${index}`,
        text,
        submittedAt: `2026-01-0${index + 1}T10:00:00Z`,
      })),
    );

    expect(result.phrases).toHaveLength(2);
    expect(result.phrases.every((phrase) => phrase.count === 2)).toBe(true);
    expect(
      result.phrases.some((phrase) => phrase.text.includes("kontakte")),
    ).toBe(true);
  });

  it("keeps separate sentences that share a common word", () => {
    const result = extractPhrases(
      [
        "Søknaden sendt. Søknaden mangler vedlegg",
        "Søknaden sendt. Søknaden mangler vedlegg",
      ].map((text, index) => ({
        id: `separate-${index}`,
        text,
        submittedAt: `2026-01-0${index + 1}T10:00:00Z`,
      })),
    );

    expect(result.phrases.map((phrase) => phrase.text)).toEqual([
      "mangler vedlegg",
      "søknaden sendt",
    ]);
  });

  it("groups inflected keywords and removes redaction markers", () => {
    expect(
      extractTopKeywords([
        "søknad",
        "søknaden",
        "søknadene [FØDSELSNUMMER FJERNET]",
      ]),
    ).toEqual([{ word: "søknad", count: 3 }]);
  });

  it("deduplicates each stemmed phrase per response and caps source ids", () => {
    const result = extractPhrases(
      [
        "Søke sykepenger og søkte sykepengene",
        "Jeg skal søke sykepenger",
        "Vil søke sykepenger",
        "Må søke sykepenger",
      ].map((text, index) => ({
        id: `response-${index}`,
        text,
        submittedAt: `2026-01-0${index + 1}T10:00:00Z`,
      })),
      { maxSourceIds: 3 },
    );

    const phrase = result.phrases.find(
      (entry) => entry.text === "søke sykepenger",
    );
    expect(phrase?.count).toBe(4);
    expect(phrase?.sourceResponseIds).toHaveLength(3);
  });

  it("removes redaction markers before building phrases", () => {
    expect(
      extractStemmedBigrams(
        "Søknad [FØDSELSNUMMER FJERNET] mangler dokumentasjon",
      ).map((bigram) => bigram.surface),
    ).toEqual(["søknad mangler", "mangler dokumentasjon"]);
  });

  it("does not build phrases across Unicode sentence boundaries", () => {
    expect(
      extractStemmedBigrams(
        "Fungerte ikke… Fant hjelp\u2028Søknaden sendt",
      ).map((bigram) => bigram.stemKey),
    ).not.toContain("fungert|fant");
  });
});
