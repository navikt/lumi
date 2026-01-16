import type {
  LogicCondition,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "./types";

/**
 * Evaluates whether a question should be visible based on its `visibleIf` condition.
 *
 * @param condition - The visibility condition to evaluate (undefined = always visible)
 * @param answers - Current answers map
 * @param metadata - Optional context metadata
 * @returns true if the question should be visible
 *
 * @example
 * ```typescript
 * const isVisible = evaluateVisibility(
 *   { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
 *   { rating: 4 }
 * );
 * // Returns: true
 * ```
 */
export function evaluateVisibility(
  condition: LogicCondition | undefined,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): boolean {
  // No condition = always visible
  if (!condition) return true;

  if (condition.field === "ANSWER") {
    const questionId = condition.questionId;

    // EXISTS operator: check if answer is defined
    if (condition.operator === "EXISTS") {
      if (!questionId) return true; // No reference = visible
      return answers[questionId] !== undefined;
    }

    // Other operators: compare with value
    if (!questionId) return true; // No reference = visible
    const answer = answers[questionId];
    return evaluateOperator(answer, condition.operator, condition.value);
  }

  if (condition.field === "METADATA") {
    const metaValue = metadata?.[condition.key];
    return evaluateOperator(metaValue, condition.operator, condition.value);
  }

  return true;
}

/**
 * Evaluates a comparison operator against a value.
 */
function evaluateOperator(
  actual: unknown,
  operator: string,
  expected: string | number | boolean | undefined,
): boolean {
  switch (operator) {
    case "EQ":
      return actual === expected;
    case "NEQ":
      return actual !== expected;
    case "GT":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual > expected
      );
    case "LT":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual < expected
      );
    case "CONTAINS":
      return Array.isArray(actual) && actual.includes(expected);
    case "EXISTS":
      return actual !== undefined;
    default:
      return true;
  }
}

/**
 * Filters a list of questions to only include those that are currently visible.
 *
 * @param questions - All questions in the survey
 * @param answers - Current answers map
 * @param metadata - Optional context metadata
 * @returns Questions that should be visible based on their visibleIf conditions
 */
export function getVisibleQuestions<T extends LumiSurveyQuestion>(
  questions: T[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): T[] {
  return questions.filter((q) =>
    evaluateVisibility(q.visibleIf, answers, metadata),
  );
}

/**
 * Checks if the submit button should be shown.
 * The button is hidden until the first required question has an answer.
 *
 * @param questions - All questions in the survey
 * @param answers - Current answers map
 * @returns true if the submit button should be visible
 */
export function shouldShowSubmitButton(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
): boolean {
  // Find first required question
  const firstRequired = questions.find((q) => q.required);

  // No required questions = always show button
  if (!firstRequired) return true;

  // Check if it has an answer
  return answers[firstRequired.id] !== undefined;
}
