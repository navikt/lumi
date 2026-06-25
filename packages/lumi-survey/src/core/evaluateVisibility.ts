import type {
  LogicLeafCondition,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
  VisibleIfCondition,
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
  condition: VisibleIfCondition | undefined,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): boolean {
  // No condition = always visible
  if (!condition) return true;

  if ("all" in condition) {
    return condition.all.every((leaf) => evaluateLeaf(leaf, answers, metadata));
  }
  if ("any" in condition) {
    return condition.any.some((leaf) => evaluateLeaf(leaf, answers, metadata));
  }

  return evaluateLeaf(condition, answers, metadata);
}

/**
 * Evaluates a single leaf condition (no groups).
 */
function evaluateLeaf(
  condition: LogicLeafCondition,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): boolean {
  if (condition.field === "METADATA") {
    const metaValue = metadata?.[condition.key];
    return evaluateOperator(metaValue, condition.operator, condition.value);
  }

  // Default: condition.field is "ANSWER" (or omitted)
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
      if (typeof actual === "string") {
        return actual.toLowerCase().includes(String(expected).toLowerCase());
      }
      return Array.isArray(actual) && actual.includes(expected);
    case "EXISTS":
      return actual !== undefined;
    default:
      // Unknown operator — fail closed to avoid showing questions by mistake
      return false;
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
  _questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
): boolean {
  const hasAnyMeaningfulAnswer = Object.values(answers).some((value) => {
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
  });

  // Progressive: never show submit before the user has provided any meaningful answer.
  // This prevents confusing "empty submit" flows.
  if (!hasAnyMeaningfulAnswer) {
    return false;
  }

  // Once the user has interacted, we keep the button visible.
  // Missing required answers are handled by validation on submit.
  return true;
}
