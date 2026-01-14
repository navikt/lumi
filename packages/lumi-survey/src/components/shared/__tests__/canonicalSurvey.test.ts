import { describe, expect, it } from "vitest";
import type { FlexJarSurveyConfig } from "../../surveyTypes.js";
import { buildCanonicalSurvey } from "../canonicalSurvey.js";

const validQuestions = [
  { id: "q1", type: "rating", prompt: "Rating" },
  { id: "q2", type: "text", prompt: "Text" },
] as const;

describe("buildCanonicalSurvey", () => {
  it("passes through questions as-is", () => {
    const survey: FlexJarSurveyConfig = {
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
    ] as unknown as FlexJarSurveyConfig["questions"];

    expect(() =>
      buildCanonicalSurvey({ questions: invalidQuestions }),
    ).toThrowError("Lumi: All questions must have an id");
  });

  it("throws if questions array is empty", () => {
    expect(() => buildCanonicalSurvey({ questions: [] })).toThrowError(
      "Lumi survey must have at least one question",
    );
  });
});
