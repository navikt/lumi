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
});
