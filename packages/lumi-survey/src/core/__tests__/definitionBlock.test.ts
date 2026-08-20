import { describe, expect, it } from "vitest";
import { buildDefinitionBlock } from "../definitionBlock.js";
import type { LumiSurveyQuestion } from "../types.js";

describe("buildDefinitionBlock", () => {
  it("builds definition with all questions regardless of answers", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "rating", type: "rating", prompt: "Rate us", variant: "emoji" },
      { id: "comment", type: "text", prompt: "Comment?", maxLength: 500 },
      {
        id: "category",
        type: "singleChoice",
        prompt: "Category?",
        options: [
          { value: "bug", label: "Bug" },
          { value: "feature", label: "Feature" },
        ],
      },
      {
        id: "tags",
        type: "multiChoice",
        prompt: "Tags?",
        options: [
          { value: "ui", label: "UI" },
          { value: "perf", label: "Performance" },
        ],
        maxSelections: 1,
      },
    ];

    const definition = buildDefinitionBlock(questions, "rating");

    expect(definition.surveyType).toBe("rating");
    expect(definition.fields).toHaveLength(4);

    expect(definition.fields[0]).toEqual({
      fieldId: "rating",
      fieldType: "RATING",
      ratingVariant: "emoji",
      ratingScale: 5,
    });

    expect(definition.fields[1]).toEqual({
      fieldId: "comment",
      fieldType: "TEXT",
    });

    expect(definition.fields[2]).toEqual({
      fieldId: "category",
      fieldType: "SINGLE_CHOICE",
      optionIds: ["bug", "feature"],
    });

    expect(definition.fields[3]).toEqual({
      fieldId: "tags",
      fieldType: "MULTI_CHOICE",
      optionIds: ["ui", "perf"],
      maxSelections: 1,
    });
  });

  it("defaults rating variant to emoji when not specified", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "r", type: "rating", prompt: "Rate?" },
    ];

    const definition = buildDefinitionBlock(questions, "custom");
    expect(definition.fields[0]).toEqual({
      fieldId: "r",
      fieldType: "RATING",
      ratingVariant: "emoji",
      ratingScale: 5,
    });
  });

  it("handles nps variant correctly", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "nps", type: "rating", prompt: "NPS?", variant: "nps" },
    ];

    const definition = buildDefinitionBlock(questions, "custom");
    expect(definition.fields[0]).toEqual({
      fieldId: "nps",
      fieldType: "RATING",
      ratingVariant: "nps",
      ratingScale: 11,
    });
  });
});
