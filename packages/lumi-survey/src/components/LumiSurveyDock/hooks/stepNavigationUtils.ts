import { getLeafConditions } from "../../../core/conditionUtils.js";
import { evaluateVisibility } from "../../../core/evaluateVisibility.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../core/types.js";

/** Check whether a survey answer value is non-empty. */
export function isAnswered(value: LumiSurveyAnswerValue | undefined): boolean {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value === "string" ? value.trim() !== "" : true) &&
    !(Array.isArray(value) && value.length === 0)
  );
}

/**
 * Returns true when at least one question after `currentIndex` is visible now
 * or could become visible once the current question is answered.
 *
 * A later question "may become reachable" if it has no `visibleIf`, if its
 * visibility depends on the current question (and could therefore change once
 * answered), or if it already evaluates as visible given current answers.
 */
export function hasReachableQuestionsAfter(
  questions: LumiSurveyQuestion[],
  currentIndex: number,
  currentQuestionId: string,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
): boolean {
  return questions.some((question, index) => {
    if (index <= currentIndex) return false;
    if (!question.visibleIf) return true;
    if (
      getLeafConditions(question.visibleIf).some(
        (leaf) =>
          leaf.field !== "METADATA" && leaf.questionId === currentQuestionId,
      )
    ) {
      return true;
    }
    return evaluateVisibility(question.visibleIf, answers, metadata);
  });
}

/**
 * Finds the best redirect target when the current step becomes invisible.
 * Priority: next visible forward → last visible in history → first visible overall.
 * Returns -1 when no visible question exists at all.
 */
export function findRedirectTarget(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
  currentStep: number,
  visitedSteps: number[],
): number {
  // 1. Try the next visible question after the current step
  const nextVisible = findNextVisibleIndex(
    questions,
    answers,
    metadata,
    currentStep + 1,
  );
  if (nextVisible !== -1) return nextVisible;

  // 2. Fall back to the last visible step the user already visited
  const historyResult = findLastVisibleInHistory(
    visitedSteps.slice(0, -1),
    questions,
    answers,
    metadata,
  );
  if (historyResult) return historyResult.step;

  // 3. Last resort: scan from the very beginning
  return findNextVisibleIndex(questions, answers, metadata, 0);
}

/**
 * Finds the last visible question index in a visited-steps history.
 * Searches backward from the end, returning both the step index and
 * the trimmed history up to (and including) that step.
 *
 * Returns `null` when no visible step is found in the history.
 */
export function findLastVisibleInHistory(
  history: number[],
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
): { step: number; history: number[] } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const step = history[i];
    const question = questions[step];
    if (question && evaluateVisibility(question.visibleIf, answers, metadata)) {
      return { step, history: history.slice(0, i + 1) };
    }
  }
  return null;
}

/**
 * Finds the first visible question index at or after `startIndex`.
 * Returns -1 when no visible question is found.
 */
export function findNextVisibleIndex(
  questions: LumiSurveyQuestion[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
  startIndex: number,
): number {
  for (let index = Math.max(0, startIndex); index < questions.length; index++) {
    const question = questions[index];
    if (evaluateVisibility(question.visibleIf, answers, metadata)) {
      return index;
    }
  }

  return -1;
}
