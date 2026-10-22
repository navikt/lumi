import { describe, expect, it } from "vitest";

import { arbeidsgiverTopics, sykmeldtTopics } from "./topics";

// Markers written by SensitiveDataFilter.DEFAULT (HIGH_CONFIDENCE_PATTERNS) in
// lumi-api. Names, addresses, IP addresses, organisation numbers, license
// plates and search parameters are left as written.
const DEFAULT_FILTER_MARKERS = [
  "[FØDSELSNUMMER FJERNET]",
  "[NAVIDENT FJERNET]",
  "[E-POST FJERNET]",
  "[TELEFON FJERNET]",
  "[KORTNUMMER FJERNET]",
  "[KONTONUMMER FJERNET]",
  "[HEMMELIG ADRESSE]",
];

function markersIn(text: string): string[] {
  return text.match(/\[[A-ZÆØÅ][A-ZÆØÅ\s-]+\]/g) ?? [];
}

describe("mock topics", () => {
  const answers = [...sykmeldtTopics, ...arbeidsgiverTopics].flatMap((topic) =>
    topic.comments.map((text) => ({
      text,
      redacted: Boolean(topic.isRedacted),
    })),
  );

  it("only uses markers that the API's default filter writes", () => {
    const markers = answers.flatMap(({ text }) => markersIn(text));

    expect(markers.length).toBeGreaterThan(0);
    expect(
      markers.filter((marker) => !DEFAULT_FILTER_MARKERS.includes(marker)),
    ).toEqual([]);
  });

  it("flags exactly the answers with a marker as redacted", () => {
    expect(
      answers.filter(
        ({ text, redacted }) => markersIn(text).length > 0 !== redacted,
      ),
    ).toEqual([]);
  });
});
