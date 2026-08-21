import { describe, expect, it } from "vitest";

import { applyFeedbackFilters } from "~/mock/utils/filters";
import type { FeedbackDto } from "~/types/api";

function makeItem(partial: Partial<FeedbackDto>): FeedbackDto {
  return {
    id: partial.id ?? "id",
    submittedAt: partial.submittedAt ?? "2026-01-01T12:00:00Z",
    app: partial.app ?? "app-1",
    surveyId: partial.surveyId ?? "survey-1",
    surveyType: partial.surveyType ?? "rating",
    context: partial.context ?? {
      deviceType: "mobile",
      url: "https://example.test",
      pathname: "/",
    },
    metadata: partial.metadata ?? null,
    answers: partial.answers ?? [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 3 },
      },
    ],
    tags: partial.tags ?? [],
    sensitiveDataRedacted: partial.sensitiveDataRedacted ?? false,
  };
}

describe("applyFeedbackFilters", () => {
  const itemA = makeItem({
    id: "a",
    submittedAt: "2026-01-01T10:00:00Z",
    context: { deviceType: "mobile" },
    metadata: { k: "v" },
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 2 },
      },
      {
        fieldId: "text",
        fieldType: "TEXT",
        question: { label: "Hvorfor?" },
        value: { type: "text", text: "har tekst" },
      },
    ],
  });

  const itemB = makeItem({
    id: "b",
    submittedAt: "2026-01-02T10:00:00Z",
    context: { deviceType: "desktop" },
    metadata: { k: "x" },
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 5 },
      },
    ],
  });

  const itemC = makeItem({
    id: "c",
    submittedAt: "2026-01-01T11:00:00Z",
    context: { deviceType: "mobile" },
    metadata: null,
    answers: [
      {
        fieldId: "rating",
        fieldType: "RATING",
        question: { label: "Hvordan?" },
        value: { type: "rating", rating: 1 },
      },
      {
        fieldId: "text",
        fieldType: "TEXT",
        question: { label: "Hvorfor?" },
        value: { type: "text", text: "også tekst" },
      },
    ],
  });

  const items = [itemA, itemB, itemC];

  it("filters by rating field filters", () => {
    const filtered = applyFeedbackFilters(items, {
      rating: "rating:5",
    });

    expect(filtered.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by date range (toDate inclusive)", () => {
    const filtered = applyFeedbackFilters(items, {
      fromDate: "2026-01-02",
      toDate: "2026-01-02",
    });

    expect(filtered.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by deviceType", () => {
    const filtered = applyFeedbackFilters(items, { deviceType: "desktop" });
    expect(filtered.map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by hasText", () => {
    const filtered = applyFeedbackFilters(items, { hasText: "true" });
    expect(filtered.map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by lowRating (<=2)", () => {
    const filtered = applyFeedbackFilters(items, { lowRating: "true" });
    expect(filtered.map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by segment key:value (requires metadata)", () => {
    const filtered = applyFeedbackFilters(items, { segment: "k:v" });
    expect(filtered.map((i) => i.id)).toEqual(["a"]);
  });

  it("combines segment + hasText + lowRating", () => {
    const filtered = applyFeedbackFilters(items, {
      segment: "k:v",
      hasText: "true",
      lowRating: "true",
    });
    expect(filtered.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by choice field filters for single and multi choice", () => {
    const withChoices: FeedbackDto[] = [
      makeItem({
        id: "single-match",
        answers: [
          {
            fieldId: "task_choice",
            fieldType: "SINGLE_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-1", label: "Søknad" }],
            },
            value: { type: "singleChoice", selectedOptionId: "opt-1" },
          },
        ],
      }),
      makeItem({
        id: "multi-match",
        answers: [
          {
            fieldId: "task_choice",
            fieldType: "MULTI_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-1", label: "Søknad" }],
            },
            value: {
              type: "multiChoice",
              selectedOptionIds: ["opt-1", "opt-2"],
            },
          },
        ],
      }),
      makeItem({
        id: "no-match",
        answers: [
          {
            fieldId: "task_choice",
            fieldType: "SINGLE_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-2", label: "Oppfølging" }],
            },
            value: { type: "singleChoice", selectedOptionId: "opt-2" },
          },
        ],
      }),
    ];

    const filtered = applyFeedbackFilters(withChoices, {
      choice: "task_choice:opt-1",
    });

    expect(filtered.map((i) => i.id).sort()).toEqual([
      "multi-match",
      "single-match",
    ]);
  });

  it("filters Discovery themes by the task field rather than answer order", () => {
    const discovery = makeItem({
      id: "discovery-theme",
      surveyType: "discovery",
      answers: [
        {
          fieldId: "blocker",
          fieldType: "TEXT",
          question: { label: "Hva hindret deg?" },
          value: { type: "text", text: "Innlogging" },
        },
        {
          fieldId: "task",
          fieldType: "TEXT",
          question: { label: "Hva prøvde du å gjøre?" },
          value: { type: "text", text: "Sjekke søknaden" },
        },
      ],
    });

    expect(
      applyFeedbackFilters([discovery], {
        theme: "33333333-3333-3333-3333-333333333333",
      }).map((item) => item.id),
    ).toEqual(["discovery-theme"]);
  });

  it("does not treat a redaction marker as Discovery theme content", () => {
    const discovery = makeItem({
      id: "redacted-theme",
      surveyType: "discovery",
      answers: [
        {
          fieldId: "task",
          fieldType: "TEXT",
          question: { label: "Hva prøvde du å gjøre?" },
          value: {
            type: "text",
            text: "[SYKEPENGER FJERNET] trenger hjelp",
          },
        },
      ],
    });

    expect(
      applyFeedbackFilters([discovery], {
        theme: "11111111-1111-1111-1111-111111111111",
      }),
    ).toEqual([]);
  });

  it("matches multi-word Discovery theme keywords", () => {
    const discovery = makeItem({
      id: "multi-word-theme",
      surveyType: "discovery",
      answers: [
        {
          fieldId: "task",
          fieldType: "TEXT",
          question: { label: "Hva prøvde du å gjøre?" },
          value: { type: "text", text: "Jeg fant ikke riktig skjema" },
        },
      ],
    });

    expect(
      applyFeedbackFilters([discovery], {
        theme: "55555555-5555-5555-5555-555555555555",
      }).map((item) => item.id),
    ).toEqual(["multi-word-theme"]);
  });

  it("returns no feedback for an unknown theme id like the API", () => {
    expect(applyFeedbackFilters([itemA], { theme: "deleted-theme" })).toEqual(
      [],
    );
  });

  it("AND-filters multiple rating and choice fields", () => {
    const withMultipleFields: FeedbackDto[] = [
      makeItem({
        id: "match",
        answers: [
          {
            fieldId: "rating-main",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 5 },
          },
          {
            fieldId: "choice-main",
            fieldType: "SINGLE_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-1", label: "Søknad" }],
            },
            value: { type: "singleChoice", selectedOptionId: "opt-1" },
          },
        ],
      }),
      makeItem({
        id: "wrong-rating",
        answers: [
          {
            fieldId: "rating-main",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 4 },
          },
          {
            fieldId: "choice-main",
            fieldType: "SINGLE_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-1", label: "Søknad" }],
            },
            value: { type: "singleChoice", selectedOptionId: "opt-1" },
          },
        ],
      }),
      makeItem({
        id: "wrong-choice",
        answers: [
          {
            fieldId: "rating-main",
            fieldType: "RATING",
            question: { label: "Hvordan?" },
            value: { type: "rating", rating: 5 },
          },
          {
            fieldId: "choice-main",
            fieldType: "SINGLE_CHOICE",
            question: {
              label: "Oppgave",
              options: [{ id: "opt-2", label: "Oppfølging" }],
            },
            value: { type: "singleChoice", selectedOptionId: "opt-2" },
          },
        ],
      }),
    ];

    const filtered = applyFeedbackFilters(withMultipleFields, {
      rating: "rating-main:5",
      choice: "choice-main:opt-1",
    });

    expect(filtered.map((i) => i.id)).toEqual(["match"]);
  });

  it("matches phrase stems after stopword removal", () => {
    const phraseItems = [
      makeItem({
        id: "phrase-match",
        answers: [
          {
            fieldId: "feedback",
            fieldType: "TEXT",
            question: { label: "Hvorfor?" },
            value: {
              type: "text",
              text: "Dette var vanskelige svaret å gi",
            },
          },
        ],
      }),
    ];

    const filtered = applyFeedbackFilters(phraseItems, {
      phrase: "feedback:vanskelig svare",
    });

    expect(filtered.map((item) => item.id)).toEqual(["phrase-match"]);
  });

  it("matches canonical discovery phrase filters against the legacy task field", () => {
    const phraseItems = [
      makeItem({
        id: "legacy-discovery",
        surveyType: "discovery",
        answers: [
          {
            fieldId: "discoveredTask",
            fieldType: "TEXT",
            question: { label: "Hva kom du for å gjøre?" },
            value: {
              type: "text",
              text: "Det er vanskelig å svare raskt",
            },
          },
        ],
      }),
    ];

    const filtered = applyFeedbackFilters(phraseItems, {
      phrase: "task:vanskelig å svare",
    });

    expect(filtered.map((item) => item.id)).toEqual(["legacy-discovery"]);
  });

  it("rejects a phrase filter with more than two content words like the API", () => {
    expect(() =>
      applyFeedbackFilters([], {
        phrase: "task:three content words",
      }),
    ).toThrow("Invalid phrase format");
  });

  it.each([
    "missing-colon",
    "task:!!!",
    "task:vanskelig/svare",
    "task:vanskelig,svare",
    "task:vanskelig-svare",
  ])("rejects malformed phrase filter %s like the API", (phrase) => {
    expect(() => applyFeedbackFilters([], { phrase })).toThrow(
      "Invalid phrase format",
    );
  });

  it.each([
    "field$:vanskelig svare",
    `field:${"a".repeat(31)} svare`,
    `field:${"a".repeat(30)} ${"b".repeat(30)} ekstra`,
  ])("rejects unsafe or oversized phrase filter %s", (phrase) => {
    expect(() => applyFeedbackFilters([], { phrase })).toThrow(
      "Invalid phrase format",
    );
  });

  it("normalizes repeated whitespace in a phrase filter like the API", () => {
    const phraseItems = [
      makeItem({
        id: "normalized-space",
        answers: [
          {
            fieldId: "feedback",
            fieldType: "TEXT",
            question: { label: "Hvorfor?" },
            value: { type: "text", text: "vanskelig å svare" },
          },
        ],
      }),
    ];

    expect(
      applyFeedbackFilters(phraseItems, {
        phrase: "feedback:vanskelig  å  svare",
      }).map((item) => item.id),
    ).toEqual(["normalized-space"]);
  });
});
