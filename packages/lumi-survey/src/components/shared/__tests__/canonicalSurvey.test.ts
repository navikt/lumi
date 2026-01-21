import { describe, expect, it } from "vitest";
import type { LumiSurveyConfig } from "../../surveyTypes.js";
import { buildCanonicalSurvey } from "../canonicalSurvey.js";

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
});
