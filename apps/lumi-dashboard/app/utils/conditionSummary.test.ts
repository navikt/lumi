import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { describe, expect, it } from "vitest";
import {
  buildConditionSummaries,
  describeVisibleIf,
} from "~/utils/conditionSummary";
import { conditionValueSuggestions } from "~/utils/surveyDocument";

function makeDocument(): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "rating",
    pages: [
      {
        id: "side-a",
        questions: [
          {
            id: "rating-1",
            type: "rating",
            prompt: "Hvordan opplevde du tjenesten?",
            variant: "emoji",
            required: true,
          },
          {
            id: "text-lav",
            type: "text",
            prompt: "Hva var vanskelig?",
            visibleIf: { questionId: "rating-1", operator: "LT", value: 3 },
          },
        ],
      },
      {
        id: "side-b",
        questions: [
          {
            id: "choice-1",
            type: "singleChoice",
            prompt: "Hva kom du for å gjøre?",
            options: [
              { value: "soke", label: "Søke" },
              { value: "sjekke-status", label: "Sjekke status" },
            ],
          },
          {
            id: "text-kryss",
            type: "text",
            prompt: "Utdyp gjerne",
            visibleIf: { questionId: "rating-1", operator: "EXISTS" },
          },
        ],
      },
    ],
  };
}

function contextFor(document: SurveyDocumentV1, ownPageNumber?: number) {
  const refs = new Map(
    document.pages.flatMap((page, pageIndex) =>
      page.questions.map(
        (question) =>
          [
            question.id,
            { prompt: question.prompt, pageNumber: pageIndex + 1 },
          ] as const,
      ),
    ),
  );
  return {
    resolveRef: (id: string) => refs.get(id) ?? null,
    suggestionsFor: (id: string) => conditionValueSuggestions(document, id),
    ownPageNumber,
  };
}

describe("describeVisibleIf", () => {
  it("renders EXISTS as «er besvart»", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "rating-1", operator: "EXISTS" },
        contextFor(document, 1),
      ),
    ).toBe("Vises når «Hvordan opplevde du tjenesten?» er besvart");
  });

  it("renders LT/GT as the actual scale slice, not the raw threshold", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "rating-1", operator: "LT", value: 3 },
        contextFor(document, 1),
      ),
    ).toBe("Vises når svaret på «Hvordan opplevde du tjenesten?» er 1–2");
    expect(
      describeVisibleIf(
        { questionId: "rating-1", operator: "GT", value: 3 },
        contextFor(document, 1),
      ),
    ).toBe("Vises når svaret på «Hvordan opplevde du tjenesten?» er 4–5");
  });

  it("falls back to over/under when the slice is empty", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "rating-1", operator: "LT", value: 1 },
        contextFor(document, 1),
      ),
    ).toBe("Vises når svaret på «Hvordan opplevde du tjenesten?» er under 1");
  });

  it("uses option labels for choice values", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "choice-1", operator: "EQ", value: "sjekke-status" },
        contextFor(document, 2),
      ),
    ).toBe("Vises når svaret på «Hva kom du for å gjøre?» er «Sjekke status»");
  });

  it("marks references that cross pages", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "rating-1", operator: "EXISTS" },
        contextFor(document, 2),
      ),
    ).toBe("Vises når «Hvordan opplevde du tjenesten?» på side 1 er besvart");
  });

  it("joins any-groups with «eller» and mixed all-groups with «og»", () => {
    const document = makeDocument();
    const ctx = contextFor(document, 1);
    expect(
      describeVisibleIf(
        {
          any: [
            { questionId: "rating-1", operator: "LT", value: 3 },
            { questionId: "rating-1", operator: "GT", value: 3 },
          ],
        },
        ctx,
      ),
    ).toContain(" eller ");
    // Not a pure numeric interval (EXISTS involved) — stays a joined list.
    expect(
      describeVisibleIf(
        {
          all: [
            { questionId: "rating-1", operator: "GT", value: 1 },
            { questionId: "choice-1", operator: "EXISTS" },
          ],
        },
        ctx,
      ),
    ).toContain(" og ");
  });

  it("collapses a same-question GT/LT all-group into one interval", () => {
    // The «Ved passive (7–8)» follow-up must read as its menu label, not as
    // two overlapping ranges.
    const document = makeDocument();
    document.pages[0].questions[0] = {
      ...document.pages[0].questions[0],
      type: "rating",
      variant: "nps",
    } as SurveyDocumentV1["pages"][number]["questions"][number];
    expect(
      describeVisibleIf(
        {
          all: [
            { questionId: "rating-1", operator: "GT", value: 6 },
            { questionId: "rating-1", operator: "LT", value: 9 },
          ],
        },
        contextFor(document, 1),
      ),
    ).toBe("Vises når svaret på «Hvordan opplevde du tjenesten?» er 7–8");
  });

  it("describes CONTAINS against free text as substring, not membership", () => {
    const document = makeDocument();
    expect(
      describeVisibleIf(
        { questionId: "text-lav", operator: "CONTAINS", value: "innlogging" },
        contextFor(document, 1),
      ),
    ).toBe("Vises når svaret på «Hva var vanskelig?» inneholder «innlogging»");
  });

  it("returns null without a condition", () => {
    expect(describeVisibleIf(undefined, contextFor(makeDocument(), 1))).toBe(
      null,
    );
  });
});

describe("buildConditionSummaries", () => {
  it("summarizes every conditional question, keyed by id", () => {
    const summaries = buildConditionSummaries(makeDocument());
    expect([...summaries.keys()].sort()).toEqual(["text-kryss", "text-lav"]);
    expect(summaries.get("text-lav")).toBe(
      "Vises når svaret på «Hvordan opplevde du tjenesten?» er 1–2",
    );
    // Cross-page reference carries the source page.
    expect(summaries.get("text-kryss")).toBe(
      "Vises når «Hvordan opplevde du tjenesten?» på side 1 er besvart",
    );
  });
});
