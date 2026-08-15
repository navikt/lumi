import {
  getLeafConditions,
  isLeafCondition,
} from "../../../core/conditionUtils.js";
import { evaluateVisibility } from "../../../core/evaluateVisibility.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../core/types.js";
import type { CanonicalSurveyPage } from "../../shared/canonicalSurvey.js";

/** Whether page visibility can change and therefore the total is conditional. */
export function surveyHasConditionalPages(
  pages: CanonicalSurveyPage[],
): boolean {
  return pages.some(
    (page) =>
      page.questions.length > 0 &&
      page.questions.every((question) => question.visibleIf !== undefined),
  );
}

export function getVisiblePageQuestions(
  page: CanonicalSurveyPage | undefined,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): LumiSurveyQuestion[] {
  if (!page) return [];
  return page.questions.filter((question) =>
    evaluateVisibility(question.visibleIf, answers, metadata),
  );
}

export function isPageVisible(
  page: CanonicalSurveyPage | undefined,
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): boolean {
  return getVisiblePageQuestions(page, answers, metadata).length > 0;
}

export function findNextVisiblePageIndex(
  pages: CanonicalSurveyPage[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
  startIndex: number,
): number {
  for (let index = Math.max(0, startIndex); index < pages.length; index++) {
    if (isPageVisible(pages[index], answers, metadata)) return index;
  }
  return -1;
}

export function findLastVisiblePageInHistory(
  history: number[],
  pages: CanonicalSurveyPage[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): { step: number; history: number[] } | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const step = history[index];
    if (isPageVisible(pages[step], answers, metadata)) {
      return { step, history: history.slice(0, index + 1) };
    }
  }
  return null;
}

export function findPageRedirectTarget(
  pages: CanonicalSurveyPage[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata: Record<string, unknown> | undefined,
  currentStep: number,
  visitedSteps: number[],
): number {
  const forward = findNextVisiblePageIndex(
    pages,
    answers,
    metadata,
    currentStep + 1,
  );
  if (forward !== -1) return forward;

  const history = findLastVisiblePageInHistory(
    visitedSteps.slice(0, -1),
    pages,
    answers,
    metadata,
  );
  if (history) return history.step;

  return findNextVisiblePageIndex(pages, answers, metadata, 0);
}

export function estimateReachablePages(
  pages: CanonicalSurveyPage[],
  answers: Record<string, LumiSurveyAnswerValue>,
  metadata?: Record<string, unknown>,
): number {
  const questionOrder = new Map<string, number>();
  pages
    .flatMap((page) => page.questions)
    .forEach((question, index) => {
      questionOrder.set(question.id, index);
    });

  return pages.filter((page) =>
    page.questions.some((question) => {
      if (evaluateVisibility(question.visibleIf, answers, metadata))
        return true;
      if (!question.visibleIf) return true;

      return getLeafConditions(question.visibleIf).some((leaf) => {
        if (!isLeafCondition(leaf)) return false;
        if (leaf.field === "METADATA" || !leaf.questionId) return true;
        if (answers[leaf.questionId] !== undefined) return false;
        return (
          (questionOrder.get(leaf.questionId) ?? Number.POSITIVE_INFINITY) <
          (questionOrder.get(question.id) ?? -1)
        );
      });
    }),
  ).length;
}
