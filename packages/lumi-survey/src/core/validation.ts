import type {
  ChoiceOption,
  ChoiceQuestion,
  FlexJarAnswerValue,
  FlexJarQuestion,
  RatingQuestion,
} from "./types";

export function validateAnswers(
  questions: FlexJarQuestion[],
  answers: Record<string, FlexJarAnswerValue>,
): string[] {
  const missingIds: string[] = [];

  for (const question of questions) {
    if (!question.required) {
      continue;
    }

    const answer = answers[question.id];

    if (!isAnswerPresent(answer)) {
      missingIds.push(question.id);
      continue;
    }

    if (!isAnswerValidForQuestion(question, answer)) {
      missingIds.push(question.id);
    }
  }

  return missingIds;
}

function isAnswerPresent(
  value: FlexJarAnswerValue | undefined,
): value is FlexJarAnswerValue {
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
  question: FlexJarQuestion,
  rawAnswer: FlexJarAnswerValue,
): boolean {
  switch (question.type) {
    case "rating":
      return isValidRatingAnswer(question, rawAnswer);
    case "text":
      return typeof rawAnswer === "string";
    case "singleChoice":
      return isValidSingleChoiceAnswer(question, rawAnswer);
    case "multiChoice":
      return isValidMultiChoiceAnswer(question, rawAnswer);
    default:
      return true;
  }
}

function isValidRatingAnswer(
  question: RatingQuestion,
  rawAnswer: FlexJarAnswerValue,
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

  const numeric = typeof rawAnswer === "number" ? rawAnswer : Number(rawAnswer);
  if (Number.isNaN(numeric)) {
    return false;
  }
  return numeric >= minValue && numeric <= maxValue;
}

function isValidSingleChoiceAnswer(
  question: ChoiceQuestion & { type: "singleChoice" },
  rawAnswer: FlexJarAnswerValue,
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
  rawAnswer: FlexJarAnswerValue,
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
  return rawAnswer.every(
    (value) => typeof value === "string" && optionValues.has(value),
  );
}
