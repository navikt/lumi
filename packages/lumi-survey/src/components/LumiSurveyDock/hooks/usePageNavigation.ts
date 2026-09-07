import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveDocumentVisibility } from "../../../core/documentVisibility.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../core/types.js";
import { validateAnswers } from "../../../core/validation.js";
import type { CanonicalSurveyPage } from "../../shared/canonicalSurvey.js";
import {
  estimateReachablePages,
  findLastVisiblePageInHistory,
  findNextVisiblePageIndex,
  findPageRedirectTarget,
  getVisiblePageQuestions,
  isPageVisible,
  surveyHasConditionalPages,
} from "./pageNavigationUtils.js";

interface UsePageNavigationOptions {
  pages: CanonicalSurveyPage[];
  answers: Record<string, LumiSurveyAnswerValue>;
  metadata?: Record<string, unknown>;
  forceStepMode?: boolean;
  autoStepMode?: boolean;
  /**
   * Start on the page with this id when it exists and is visible.
   * Falls back to the first visible page. Intended for embedded previews
   * that mirror a specific authored page.
   */
  initialPageId?: string;
  onStepChange?: (visibleStepIndex: number, totalVisibleSteps: number) => void;
}

export interface UsePageNavigationReturn {
  isStepMode: boolean;
  currentStep: number;
  currentPage: CanonicalSurveyPage | undefined;
  currentPageQuestions: LumiSurveyQuestion[];
  currentQuestion: LumiSurveyQuestion | undefined;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  goToNext: () => { nextIndex: number } | null;
  goToPrevious: () => number | null;
  resetNavigation: () => void;
  hasBranching: boolean;
  visitedSteps: number[];
  visibleStepIndex: number;
  totalVisibleSteps: number;
}

export function usePageNavigation({
  pages,
  answers,
  metadata,
  forceStepMode = false,
  autoStepMode = false,
  initialPageId,
  onStepChange,
}: UsePageNavigationOptions): UsePageNavigationReturn {
  const visiblePages = useMemo(() => {
    const { visibleQuestionIds } = resolveDocumentVisibility(
      pages.flatMap((page) => page.questions),
      answers,
      metadata,
    );
    return pages.map((page) => ({
      ...page,
      questions: page.questions.filter((question) =>
        visibleQuestionIds.has(question.id),
      ),
    }));
  }, [pages, answers, metadata]);
  const hasBranching = useMemo(() => surveyHasConditionalPages(pages), [pages]);
  const isStepMode = forceStepMode || autoStepMode;
  const resolveInitialStep = useCallback(() => {
    if (initialPageId !== undefined) {
      const requested = pages.findIndex((page) => page.id === initialPageId);
      if (
        requested !== -1 &&
        isPageVisible(visiblePages[requested], answers, metadata)
      ) {
        return requested;
      }
    }
    return findNextVisiblePageIndex(visiblePages, answers, metadata, 0);
  }, [answers, initialPageId, metadata, pages, visiblePages]);

  const [currentStep, setCurrentStep] = useState(resolveInitialStep);
  const [visitedSteps, setVisitedSteps] = useState<number[]>(() => {
    const first = resolveInitialStep();
    return first === -1 ? [] : [first];
  });

  const currentPage = pages[currentStep];
  const currentPageQuestions = useMemo(
    () => getVisiblePageQuestions(visiblePages[currentStep], answers, metadata),
    [visiblePages, currentStep, answers, metadata],
  );
  const currentQuestion = currentPageQuestions[0];
  const canGoBack = visitedSteps.length > 1;
  const canGoNext =
    currentPageQuestions.length > 0 &&
    validateAnswers(currentPageQuestions, answers).length === 0;
  const isLastStep =
    currentStep >= 0 &&
    findNextVisiblePageIndex(
      visiblePages,
      answers,
      metadata,
      currentStep + 1,
    ) === -1;

  const reachablePages = useMemo(
    () => estimateReachablePages(pages, answers, metadata),
    [pages, answers, metadata],
  );
  const reachablePagesRef = useRef(reachablePages);
  reachablePagesRef.current = reachablePages;
  const [displayedTotal, setDisplayedTotal] = useState(reachablePages);

  const visibleStepIndex = useMemo(() => {
    if (currentStep < 0) return -1;
    let visibleBefore = 0;
    for (let index = 0; index < currentStep; index++) {
      if (isPageVisible(visiblePages[index], answers, metadata))
        visibleBefore++;
    }
    return visibleBefore;
  }, [answers, currentStep, metadata, visiblePages]);

  const pageDefinitionKey = useMemo(() => JSON.stringify(pages), [pages]);
  const previousPageDefinitionKeyRef = useRef(pageDefinitionKey);
  const previousStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousPageDefinitionKeyRef.current === pageDefinitionKey) return;
    previousPageDefinitionKeyRef.current = pageDefinitionKey;
    previousStepRef.current = null;
    const first = resolveInitialStep();
    setCurrentStep(first);
    setVisitedSteps(first === -1 ? [] : [first]);
    setDisplayedTotal(reachablePages);
  }, [pageDefinitionKey, reachablePages, resolveInitialStep]);

  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  useEffect(() => {
    if (!isStepMode || currentStep < 0) return;
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    onStepChangeRef.current?.(visibleStepIndex, displayedTotal);
  }, [currentStep, displayedTotal, isStepMode, visibleStepIndex]);

  const goToNext = useCallback(() => {
    if (!currentPage || !canGoNext) return null;
    const next = findNextVisiblePageIndex(
      visiblePages,
      answers,
      metadata,
      currentStep + 1,
    );
    if (next === -1) return { nextIndex: -1 };

    setCurrentStep(next);
    setVisitedSteps((previous) => [...previous, next]);
    setDisplayedTotal(reachablePagesRef.current);
    return { nextIndex: next };
  }, [answers, canGoNext, currentPage, currentStep, metadata, visiblePages]);

  const goToPrevious = useCallback(() => {
    if (visitedSteps.length <= 1) return null;
    const result = findLastVisiblePageInHistory(
      visitedSteps.slice(0, -1),
      visiblePages,
      answers,
      metadata,
    );
    if (!result) return null;
    setVisitedSteps(result.history);
    setCurrentStep(result.step);
    setDisplayedTotal(reachablePagesRef.current);
    return result.step;
  }, [answers, metadata, visiblePages, visitedSteps]);

  const resetNavigation = useCallback(() => {
    const first = resolveInitialStep();
    setCurrentStep(first);
    setVisitedSteps(first === -1 ? [] : [first]);
    setDisplayedTotal(reachablePagesRef.current);
  }, [resolveInitialStep]);

  useEffect(() => {
    if (!isStepMode) return;
    if (isPageVisible(visiblePages[currentStep], answers, metadata)) return;

    const target = findPageRedirectTarget(
      visiblePages,
      answers,
      metadata,
      currentStep,
      visitedSteps,
    );
    if (target === -1) {
      if (currentStep !== -1) setCurrentStep(-1);
      if (visitedSteps.length > 0) setVisitedSteps([]);
      return;
    }
    if (target === currentStep) return;
    setCurrentStep(target);
    setVisitedSteps((previous) => {
      const existing = previous.indexOf(target);
      return existing === -1
        ? [...previous, target]
        : previous.slice(0, existing + 1);
    });
    setDisplayedTotal(reachablePagesRef.current);
  }, [answers, currentStep, isStepMode, metadata, visiblePages, visitedSteps]);

  return {
    isStepMode,
    currentStep,
    currentPage,
    currentPageQuestions,
    currentQuestion,
    canGoBack,
    canGoNext,
    isLastStep,
    goToNext,
    goToPrevious,
    resetNavigation,
    hasBranching,
    visitedSteps,
    visibleStepIndex,
    totalVisibleSteps: displayedTotal,
  };
}
