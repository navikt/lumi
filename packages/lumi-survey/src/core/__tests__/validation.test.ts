import { describe, expect, it } from "vitest";
import type { LumiSurveyQuestion } from "../types.js";
import { validateAnswers } from "../validation.js";

describe("validateAnswers", () => {
  it("only validates explicitly required questions", () => {
    const questions: LumiSurveyQuestion[] = [
      {
        id: "rating",
        type: "rating",
        prompt: "Hvor fornøyd er du?",
        // required intentionally omitted
      },
      {
        id: "feedback",
        type: "text",
        prompt: "Kommentar",
        required: true,
      },
    ];

    expect(validateAnswers(questions, {})).toEqual(["feedback"]);
    expect(validateAnswers(questions, { rating: 5 })).toEqual(["feedback"]);
    expect(validateAnswers(questions, { rating: 5, feedback: "Hei" })).toEqual(
      [],
    );
  });

  it.each([
    { variant: "emoji" as const, invalidValue: 1.5 },
    { variant: "thumbs" as const, invalidValue: 1.5 },
    { variant: "stars" as const, invalidValue: 2.5 },
    { variant: "nps" as const, invalidValue: 9.5 },
  ])("rejects non-integer $variant ratings", ({ variant, invalidValue }) => {
    const question: LumiSurveyQuestion = {
      id: "rating",
      type: "rating",
      variant,
      prompt: "Hvor fornøyd er du?",
      required: true,
    };

    expect(validateAnswers([question], { rating: invalidValue })).toEqual([
      "rating",
    ]);
  });

  it.each([
    { label: "numeric string", invalidValue: "2" },
    { label: "single-value array", invalidValue: ["2"] },
  ])("rejects a $label as a rating answer", ({ invalidValue }) => {
    const question: LumiSurveyQuestion = {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvor fornøyd er du?",
      required: true,
    };

    expect(validateAnswers([question], { rating: invalidValue })).toEqual([
      "rating",
    ]);
  });

  it("validates optional answers when a value is present", () => {
    const question: LumiSurveyQuestion = {
      id: "choice",
      type: "singleChoice",
      prompt: "Velg",
      required: false,
      options: [{ value: "known", label: "Kjent" }],
    };

    expect(validateAnswers([question], {})).toEqual([]);
    expect(validateAnswers([question], { choice: "unknown" })).toEqual([
      "choice",
    ]);
  });

  it("enforces unique multi-choice values and maxSelections", () => {
    const question: LumiSurveyQuestion = {
      id: "priority",
      type: "multiChoice",
      prompt: "Velg",
      maxSelections: 2,
      options: [
        { value: "one", label: "Én" },
        { value: "two", label: "To" },
        { value: "three", label: "Tre" },
      ],
    };

    expect(validateAnswers([question], { priority: ["one", "two"] })).toEqual(
      [],
    );
    expect(validateAnswers([question], { priority: ["one", "one"] })).toEqual([
      "priority",
    ]);
    expect(
      validateAnswers([question], { priority: ["one", "two", "three"] }),
    ).toEqual(["priority"]);
  });
});
