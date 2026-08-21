import { describe, expect, it } from "vitest";

import {
  extractPhrases,
  extractStemmedBigrams,
  textMatchesPhrase,
} from "./phrases";

describe("mock phrase analysis", () => {
  it("mirrors the API by removing stopwords and grouping inflected forms", () => {
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
      text: "vanskelig svare",
      count: 2,
      sourceResponseIds: ["first", "second"],
    });
    expect(
      textMatchesPhrase("Dette var vanskelige svaret", "vanskelig svare"),
    ).toBe(true);
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
});
