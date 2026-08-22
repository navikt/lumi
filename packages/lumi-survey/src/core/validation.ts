import { getTextAnswerMaxLength } from "./textAnswerLimits.js";
import type {
  ChoiceOption,
  ChoiceQuestion,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
  RatingQuestion,
  TextQuestion,
} from "./types";

export function validateAnswers(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
): string[] {
  const missingIds: string[] = [];

  for (const question of questions) {
    if (getAnswerValidationIssue(question, answers[question.id])) {
      missingIds.push(question.id);
    }
  }

  return missingIds;
}

export type AnswerValidationIssue =
  | { type: "missing" }
  | { type: "invalid" }
  | { type: "textTooLong"; maxLength: number };

export function getAnswerValidationIssue(
  question: LumiSurveyQuestion,
  answer: LumiSurveyAnswerValue | undefined,
): AnswerValidationIssue | undefined {
  // Optional blank answers are normally ignored. Check the raw text length
  // first so an over-limit whitespace value from initial state cannot reach
  // the API even though it trims to an empty answer.
  if (question.type === "text" && typeof answer === "string") {
    const maxLength = getTextAnswerMaxLength(question);
    if (answer.length > maxLength) {
      return { type: "textTooLong", maxLength };
    }
  }

  if (!isAnswerPresent(answer)) {
    return question.required ? { type: "missing" } : undefined;
  }

  return isAnswerValidForQuestion(question, answer)
    ? undefined
    : { type: "invalid" };
}

function isAnswerPresent(
  value: LumiSurveyAnswerValue | undefined,
): value is LumiSurveyAnswerValue {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function isAnswerValidForQuestion(
  question: LumiSurveyQuestion,
  rawAnswer: LumiSurveyAnswerValue,
): boolean {
  switch (question.type) {
    case "rating":
      return isValidRatingAnswer(question, rawAnswer);
    case "text":
      return isValidTextAnswer(question, rawAnswer);
    case "singleChoice":
      return isValidSingleChoiceAnswer(question, rawAnswer);
    case "multiChoice":
      return isValidMultiChoiceAnswer(question, rawAnswer);
    default:
      return true;
  }
}

function isValidTextAnswer(
  question: TextQuestion,
  rawAnswer: LumiSurveyAnswerValue,
): boolean {
  return (
    typeof rawAnswer === "string" &&
    rawAnswer.length <= getTextAnswerMaxLength(question)
  );
}

function isValidRatingAnswer(
  question: RatingQuestion,
  rawAnswer: LumiSurveyAnswerValue,
): boolean {
  // Get scale from variant (fixed scales per variant)
  const variant = question.variant ?? "emoji";
  let minValue = 1;
  let maxValue: number;

  switch (variant) {
    case "thumbs":
      maxValue = 2;
      break;
    case "nps":
      minValue = 0;
      maxValue = 10;
      break;
    default: // emoji, stars
      maxValue = 5;
  }

  if (typeof rawAnswer !== "number" || !Number.isInteger(rawAnswer)) {
    return false;
  }
  return rawAnswer >= minValue && rawAnswer <= maxValue;
}

function isValidSingleChoiceAnswer(
  question: ChoiceQuestion & { type: "singleChoice" },
  rawAnswer: LumiSurveyAnswerValue,
): boolean {
  if (typeof rawAnswer !== "string") {
    return false;
  }

  return question.options.some(
    ({ value }: ChoiceOption) => value === rawAnswer,
  );
}

function isValidMultiChoiceAnswer(
  question: ChoiceQuestion & { type: "multiChoice" },
  rawAnswer: LumiSurveyAnswerValue,
): boolean {
  if (!Array.isArray(rawAnswer)) {
    return false;
  }

  if (rawAnswer.length === 0) {
    return false;
  }

  const optionValues = new Set(
    question.options.map(({ value }: ChoiceOption) => value),
  );
  if (new Set(rawAnswer).size !== rawAnswer.length) return false;
  if (
    question.maxSelections !== undefined &&
    rawAnswer.length > question.maxSelections
  ) {
    return false;
  }
  return rawAnswer.every(
    (value) => typeof value === "string" && optionValues.has(value),
  );
}
