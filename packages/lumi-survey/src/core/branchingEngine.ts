import type {
  LogicLeafCondition,
  LogicOperator,
  LogicRule,
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "./types.js";

/**
 * Result of evaluating branching logic.
 */
export interface BranchingResult {
  /** The index of the next question to show, or -1 to submit */
  nextIndex: number;
  /** Whether this was determined by a logic rule (true) or default behavior (false) */
  triggeredByRule: boolean;
  /** The rule that triggered, if any */
  matchedRule?: LogicRule;
}

/**
 * Evaluates a single condition against an answer or metadata value.
 */
function evaluateCondition(
  condition: LogicLeafCondition,
  currentAnswer: LumiSurveyAnswerValue | undefined,
  metadata: Record<string, unknown> | undefined,
  answers: Record<string, LumiSurveyAnswerValue> | undefined,
): boolean {
  // Determine the actual value to compare
  let actualValue: unknown;

  if (condition.field === "METADATA") {
    actualValue = metadata?.[condition.key];
  } else {
    // Default: condition.field is "ANSWER" (or omitted). A questionId
    // references another question's answer (cross-question); without one, the
    // condition applies to the current question's own answer. Mirrors
    // evaluateVisibility() so logic and visibleIf resolve answers the same way.
    actualValue = condition.questionId
      ? answers?.[condition.questionId]
      : currentAnswer;
  }

  // Handle EXISTS operator separately
  if (condition.operator === "EXISTS") {
    return actualValue !== undefined && actualValue !== null;
  }

  // Handle undefined/null values
  if (actualValue === undefined || actualValue === null) {
    // Only EQ/NEQ make sense for undefined
    if (condition.operator === "EQ") {
      return condition.value === undefined || condition.value === null;
    }
    if (condition.operator === "NEQ") {
      return condition.value !== undefined && condition.value !== null;
    }
    return false;
  }

  // For other operators, value must be defined
  if (condition.value === undefined) {
    return false;
  }

  return compareValues(actualValue, condition.operator, condition.value);
}

/**
 * Compares two values using the specified operator.
 */
function compareValues(
  actual: unknown,
  operator: LogicOperator,
  expected: string | number | boolean,
): boolean {
  const compareWithCoercion = (): boolean => {
    if (typeof actual === "number" && typeof expected === "string") {
      const asNumber = Number(expected);
      return Number.isFinite(asNumber) ? actual === asNumber : false;
    }

    if (typeof actual === "string" && typeof expected === "number") {
      const asNumber = Number(actual);
      return Number.isFinite(asNumber) ? asNumber === expected : false;
    }

    return actual === expected;
  };

  switch (operator) {
    case "EQ":
      // Handle array comparison for multiChoice
      if (Array.isArray(actual)) {
        return actual.includes(expected as string);
      }
      return compareWithCoercion();

    case "NEQ":
      if (Array.isArray(actual)) {
        return !actual.includes(expected as string);
      }
      return !compareWithCoercion();

    case "GT":
      return typeof actual === "number" && actual > (expected as number);

    case "LT":
      return typeof actual === "number" && actual < (expected as number);

    case "CONTAINS":
      if (typeof actual === "string") {
        return actual.toLowerCase().includes(String(expected).toLowerCase());
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected as string);
      }
      return false;

    case "EXISTS":
      return actual !== undefined && actual !== null;

    default:
      return false;
  }
}

/**
 * Finds the index of a question by its ID.
 * Returns -1 if not found.
 */
function findQuestionIndex(
  questions: LumiSurveyQuestion[],
  targetId: string,
): number {
  return questions.findIndex((q) => q.id === targetId);
}

/**
 * Evaluates branching rules for a question and determines the next step.
 *
 * @param currentQuestion - The question that was just answered
 * @param currentAnswer - The user's answer to the current question
 * @param metadata - Optional survey metadata for METADATA conditions
 * @param questions - All questions in the survey
 * @param currentIndex - The index of the current question
 * @param answers - All answers so far, keyed by question id. Used to resolve
 *   conditions that reference another question via `condition.questionId`.
 *   Optional for backward compatibility, but cross-question (`questionId`)
 *   conditions silently fall back to the current answer when it is omitted —
 *   callers with branching logic should always pass the full answers map.
 * @returns BranchingResult indicating the next question index
 */
export function evaluateBranching(
  currentQuestion: LumiSurveyQuestion,
  currentAnswer: LumiSurveyAnswerValue | undefined,
  metadata: Record<string, unknown> | undefined,
  questions: LumiSurveyQuestion[],
  currentIndex: number,
  answers?: Record<string, LumiSurveyAnswerValue>,
): BranchingResult {
  const rules = currentQuestion.logic;

  // No rules defined - default to next question
  if (!rules || rules.length === 0) {
    return {
      nextIndex: currentIndex + 1,
      triggeredByRule: false,
    };
  }

  // Evaluate rules in order - first match wins
  for (const rule of rules) {
    const matches = evaluateCondition(
      rule.condition,
      currentAnswer,
      metadata,
      answers,
    );

    if (matches) {
      switch (rule.action.type) {
        case "JUMP_TO": {
          // TypeScript guarantees targetId exists for JUMP_TO
          const targetIndex = findQuestionIndex(
            questions,
            rule.action.targetId,
          );
          if (targetIndex === -1) {
            console.warn(`JUMP_TO target '${rule.action.targetId}' not found`);
            break;
          }
          return {
            nextIndex: targetIndex,
            triggeredByRule: true,
            matchedRule: rule,
          };
        }

        case "SKIP":
          // Skip next question (go to currentIndex + 2)
          return {
            nextIndex: currentIndex + 2,
            triggeredByRule: true,
            matchedRule: rule,
          };

        case "SUBMIT":
          // Signal submission with -1
          return {
            nextIndex: -1,
            triggeredByRule: true,
            matchedRule: rule,
          };
      }
    }
  }

  // No rules matched - default to next question
  return {
    nextIndex: currentIndex + 1,
    triggeredByRule: false,
  };
}

/**
 * Checks if a survey has any branching logic configured.
 * Used to determine if step-based navigation should be enabled.
 */
export function surveyHasBranchingLogic(
  questions: LumiSurveyQuestion[],
): boolean {
  return questions.some((q) => q.logic && q.logic.length > 0);
}

/**
 * Validates that all JUMP_TO targetIds exist in the questions array.
 * Returns an array of invalid targetIds.
 */
export function validateBranchingTargets(
  questions: LumiSurveyQuestion[],
): string[] {
  const questionIds = new Set(questions.map((q) => q.id));
  const invalidTargets: string[] = [];

  for (const question of questions) {
    if (!question.logic) continue;

    for (const rule of question.logic) {
      if (rule.action.type === "JUMP_TO" && rule.action.targetId) {
        if (!questionIds.has(rule.action.targetId)) {
          invalidTargets.push(rule.action.targetId);
        }
      }
    }
  }

  return invalidTargets;
}
