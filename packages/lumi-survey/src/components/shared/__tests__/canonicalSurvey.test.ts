import { describe, expect, it } from "vitest";
import type { LumiSurveyConfig, SurveyDocumentV1 } from "../../surveyTypes.js";
import {
  buildCanonicalSurvey,
  validateSurveyDocumentV1,
} from "../canonicalSurvey.js";

const validQuestions = [
  { id: "q1", type: "rating", prompt: "Rating" },
  { id: "q2", type: "text", prompt: "Text" },
] as const;

describe("buildCanonicalSurvey", () => {
  it("passes through questions as-is", () => {
    const survey: LumiSurveyConfig = {
      questions: [...validQuestions],
    };

    const canonical = buildCanonicalSurvey(survey);
    expect(canonical.questions).toEqual(validQuestions);
    expect(canonical.type).toBe("custom");
    expect(canonical.source).toBe("legacy");
    expect(canonical.pages.map((page) => page.questions)).toEqual([
      [validQuestions[0]],
      [validQuestions[1]],
    ]);
  });

  it("normalizes an explicit page document without changing flat question order", () => {
    const survey: SurveyDocumentV1 = {
      authoringSchemaVersion: 1,
      type: "custom",
      pages: [
        {
          id: "first-page",
          title: "Første side",
          description: "Svar på begge spørsmålene.",
          questions: [
            { id: "q1", type: "rating", prompt: "Rating" },
            { id: "q2", type: "text", prompt: "Text" },
          ],
        },
        {
          id: "second-page",
          questions: [{ id: "q3", type: "text", prompt: "More text" }],
        },
      ],
    };

    const canonical = buildCanonicalSurvey(survey);

    expect(canonical.source).toBe("document-v1");
    expect(canonical.questions.map((question) => question.id)).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    expect(canonical.pages).toMatchObject([
      {
        id: "first-page",
        title: "Første side",
        description: "Svar på begge spørsmålene.",
        questions: [{ id: "q1" }, { id: "q2" }],
      },
      { id: "second-page", questions: [{ id: "q3" }] },
    ]);
  });

  it("rejects duplicate and empty pages in document input", () => {
    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "same",
            questions: [{ id: "q1", type: "text", prompt: "Q1" }],
          },
          {
            id: "same",
            questions: [{ id: "q2", type: "text", prompt: "Q2" }],
          },
        ],
      }),
    ).toThrowError(/duplicate page id/i);

    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [{ id: "empty", questions: [] }],
      } as unknown as SurveyDocumentV1),
    ).toThrowError(/at least one question/i);
  });

  it("rejects logic and forward visibleIf references in document input", () => {
    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "page",
            questions: [
              {
                id: "q1",
                type: "text",
                prompt: "Q1",
                logic: [
                  {
                    condition: { operator: "EXISTS" },
                    action: { type: "SUBMIT" },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as SurveyDocumentV1),
    ).toThrowError(/version 1.*visibleIf/i);

    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "page",
            questions: [
              {
                id: "q1",
                type: "text",
                prompt: "Q1",
                visibleIf: { operator: "EXISTS", questionId: "q2" },
              },
              { id: "q2", type: "text", prompt: "Q2" },
            ],
          },
        ],
      }),
    ).toThrowError(/only reference earlier questions/i);
  });

  it("rejects unknown authoring schema versions", () => {
    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 2,
        pages: [],
      } as unknown as SurveyDocumentV1),
    ).toThrowError(/unsupported authoringSchemaVersion/i);
  });

  it("requires answer conditions in documents to reference a question", () => {
    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "page",
            questions: [
              {
                id: "q1",
                type: "text",
                prompt: "Q1",
                visibleIf: { operator: "EXISTS" },
              },
            ],
          },
        ],
      } as unknown as SurveyDocumentV1),
    ).toThrowError(/without a questionId/i);

    expect(() =>
      buildCanonicalSurvey({
        questions: [
          {
            id: "legacy",
            type: "text",
            prompt: "Legacy",
            visibleIf: { operator: "EXISTS" },
          },
        ],
      }),
    ).not.toThrow();
  });

  it("requires comparison values in document visibility conditions", () => {
    expect(() =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [
          {
            id: "page",
            questions: [
              { id: "q1", type: "text", prompt: "Q1" },
              {
                id: "q2",
                type: "text",
                prompt: "Q2",
                visibleIf: { questionId: "q1", operator: "EQ" },
              },
            ],
          },
        ],
      } as unknown as SurveyDocumentV1),
    ).toThrowError(/without a value/i);
  });

  it("rejects malformed document pages and question payloads cleanly", () => {
    const buildRaw = (page: unknown) =>
      buildCanonicalSurvey({
        authoringSchemaVersion: 1,
        pages: [page],
      } as unknown as SurveyDocumentV1);

    expect(() =>
      buildRaw({ id: "page", title: {}, questions: [validQuestions[1]] }),
    ).toThrowError(/non-string title/i);
    expect(() => buildRaw({ id: "page", questions: [null] })).toThrowError(
      /not a question object/i,
    );
    expect(() =>
      buildRaw({
        id: "page",
        questions: [{ id: "choice", type: "singleChoice", prompt: "Choice" }],
      }),
    ).toThrowError(/valid options/i);
    expect(() =>
      buildRaw({
        id: "page",
        questions: [
          { id: "rating", type: "rating", prompt: "Rating", variant: "ten" },
        ],
      }),
    ).toThrowError(/unsupported variant/i);
    expect(() =>
      buildRaw({
        id: "page",
        questions: [
          {
            id: "nps",
            type: "rating",
            variant: "nps",
            prompt: "NPS",
            lowLabel: {},
          },
        ],
      }),
    ).toThrowError(/non-string lowLabel/i);
    expect(() =>
      buildRaw({
        id: "page",
        questions: [
          { id: "text", type: "text", prompt: "Text", maxLength: "100" },
        ],
      }),
    ).toThrowError(/invalid maxLength/i);
    expect(() =>
      buildRaw({
        id: "page",
        questions: [
          {
            id: "choice",
            type: "multiChoice",
            prompt: "Choice",
            options: [{ value: "yes", label: "Yes" }],
            maxSelections: 0,
          },
        ],
      }),
    ).toThrowError(/invalid maxSelections/i);
  });

  it("sets survey type if provided", () => {
    const canonical = buildCanonicalSurvey({
      type: "rating",
      questions: [...validQuestions],
    });
    expect(canonical.type).toBe("rating");
  });

  it("validates that all questions have IDs", () => {
    const invalidQuestions = [
      { type: "text", prompt: "No ID" },
    ] as unknown as LumiSurveyConfig["questions"];

    expect(() =>
      buildCanonicalSurvey({ questions: invalidQuestions }),
    ).toThrowError("Lumi: All questions must have an id");
  });

  it("throws if questions array is empty", () => {
    expect(() => buildCanonicalSurvey({ questions: [] })).toThrowError(
      "Lumi survey must have at least one question",
    );
  });

  it("throws if visibleIf references unknown questionId", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: { operator: "EXISTS", questionId: "does-not-exist" },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/visibleIf\.questionId/i);
  });

  it("throws if branching logic jumps to unknown targetId", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          {
            id: "q1",
            type: "singleChoice",
            prompt: "Choice",
            required: true,
            options: [{ value: "yes", label: "Ja" }],
            logic: [
              {
                condition: { operator: "EXISTS" },
                action: { type: "JUMP_TO", targetId: "missing" },
              },
            ],
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/targetId/i);
  });

  it("defaults first rating question to required for rating surveys", () => {
    const canonical = buildCanonicalSurvey({
      type: "rating",
      questions: [
        {
          id: "rating",
          type: "rating",
          prompt: "Rating",
          // required intentionally omitted
        },
        {
          id: "comment",
          type: "text",
          prompt: "Comment",
          required: false,
          visibleIf: { operator: "EXISTS", questionId: "rating" },
        },
      ] as unknown as LumiSurveyConfig["questions"],
    });

    expect(canonical.type).toBe("rating");
    expect(canonical.questions[0]?.required).toBe(true);
  });

  it("throws if a visibleIf group references an unknown questionId", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: {
              any: [{ operator: "EQ", questionId: "ghost", value: "nei" }],
            },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/visibleIf\.questionId/i);
  });

  it("throws if a visibleIf group is empty", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          { id: "q2", type: "text", prompt: "Text", visibleIf: { any: [] } },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/empty visibleIf .*group/i);
  });

  it("throws if a logic condition is an any/all group", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          {
            id: "q1",
            type: "singleChoice",
            prompt: "Choice",
            required: true,
            options: [{ value: "yes", label: "Ja" }],
            logic: [
              {
                condition: { any: [{ operator: "EXISTS" }] },
                action: { type: "SUBMIT" },
              },
            ],
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/logic.*group|group.*logic/i);
  });

  it("throws a clean error (no crash) for a null/invalid logic.condition", () => {
    const make = (condition: unknown) =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          {
            id: "q1",
            type: "singleChoice",
            prompt: "Choice",
            required: true,
            options: [{ value: "yes", label: "Ja" }],
            logic: [{ condition, action: { type: "SUBMIT" } }],
          },
        ] as unknown as LumiSurveyConfig["questions"],
      });
    expect(() => make(null)).toThrowError(/invalid logic\.condition/i);
    expect(() => make({})).toThrowError(/invalid logic\.condition/i);
    expect(() => make({ operator: "BOGUS" })).toThrowError(
      /invalid logic\.condition/i,
    );
  });

  it("throws if a visibleIf group is nested", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: {
              all: [{ any: [{ operator: "EXISTS", questionId: "q1" }] }],
            },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/nested visibleIf group/i);
  });

  it("throws if a visibleIf group has both any and all", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: {
              any: [{ operator: "EXISTS", questionId: "q1" }],
              all: [],
            },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/both "any" and "all"/i);
  });

  it("throws a clean error for a non-array visibleIf group body", () => {
    expect(() =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: { any: "nope" },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      }),
    ).toThrowError(/not a list/i);
  });

  it("throws if visibleIf is a non-object value (false/0/empty string)", () => {
    for (const bad of [false, 0, ""]) {
      expect(() =>
        buildCanonicalSurvey({
          type: "custom",
          questions: [
            { id: "q1", type: "rating", prompt: "Rating", required: true },
            { id: "q2", type: "text", prompt: "Text", visibleIf: bad },
          ] as unknown as LumiSurveyConfig["questions"],
        }),
      ).toThrowError(/not a condition object/i);
    }
  });

  it("throws a clean error (no crash) for null/invalid group members", () => {
    const make = (member: unknown) =>
      buildCanonicalSurvey({
        type: "custom",
        questions: [
          { id: "q1", type: "rating", prompt: "Rating", required: true },
          {
            id: "q2",
            type: "text",
            prompt: "Text",
            visibleIf: { any: [member] },
          },
        ] as unknown as LumiSurveyConfig["questions"],
      });
    // Old code read `.field` off the member and threw a raw TypeError on null.
    expect(() => make(null)).toThrowError(/invalid visibleIf condition/i);
    expect(() => make({})).toThrowError(/invalid visibleIf condition/i);
    expect(() => make(1)).toThrowError(/invalid visibleIf condition/i);
    expect(() => make({ operator: "BOGUS", questionId: "q1" })).toThrowError(
      /invalid visibleIf condition/i,
    );
  });
});

describe("validateSurveyDocumentV1", () => {
  it("returns a valid V1 document unchanged", () => {
    const document = {
      authoringSchemaVersion: 1 as const,
      pages: [
        {
          id: "page-1",
          questions: [
            {
              id: "rating",
              type: "rating" as const,
              prompt: "Hvordan gikk det?",
            },
          ],
        },
      ],
    };

    expect(validateSurveyDocumentV1(document)).toBe(document);
  });

  it("rejects unknown authoring payloads before preview", () => {
    expect(() =>
      validateSurveyDocumentV1({ authoringSchemaVersion: 1, pages: [] }),
    ).toThrow("at least one page");
  });

  it("accepts optional intro and success content", () => {
    const document = {
      authoringSchemaVersion: 1 as const,
      intro: {
        title: "Velkommen",
        body: "To korte spørsmål.",
        startLabel: "Kom i gang",
      },
      success: { title: "Takk!", body: "Svaret er sendt." },
      pages: [
        {
          id: "page-1",
          questions: [
            {
              id: "rating",
              type: "rating" as const,
              prompt: "Hvordan gikk det?",
            },
          ],
        },
      ],
    };

    expect(validateSurveyDocumentV1(document)).toBe(document);
  });

  it("rejects malformed intro and success shapes", () => {
    const base = {
      authoringSchemaVersion: 1 as const,
      pages: [
        {
          id: "page-1",
          questions: [
            {
              id: "rating",
              type: "rating" as const,
              prompt: "Hvordan gikk det?",
            },
          ],
        },
      ],
    };

    expect(() =>
      validateSurveyDocumentV1({ ...base, intro: { title: 42 } }),
    ).toThrow(/intro/i);
    expect(() =>
      validateSurveyDocumentV1({ ...base, intro: "Velkommen" }),
    ).toThrow(/intro/i);
    expect(() =>
      validateSurveyDocumentV1({ ...base, success: { title: null } }),
    ).toThrow(/success/i);
  });
});
