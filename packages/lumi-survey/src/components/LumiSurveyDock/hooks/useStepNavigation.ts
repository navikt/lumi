import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type BranchingResult,
  evaluateBranching,
  surveyHasBranchingLogic,
  surveyHasVisibilityBranching,
} from "../../../core/branchingEngine.js";
import { computeReachableSteps } from "../../../core/computeReachableSteps.js";
import { evaluateVisibility } from "../../../core/evaluateVisibility.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../core/types.js";
import {
  findLastVisibleInHistory,
  findNextVisibleIndex,
  findRedirectTarget,
  hasReachableQuestionsAfter,
  isAnswered,
} from "./stepNavigationUtils.js";

export {
  findLastVisibleInHistory,
  findNextVisibleIndex,
  findRedirectTarget,
  hasReachableQuestionsAfter,
  isAnswered,
} from "./stepNavigationUtils.js";

export interface UseStepNavigationOptions {
  questions: LumiSurveyQuestion[];
  answers: Record<string, LumiSurveyAnswerValue>;
  metadata?: Record<string, unknown>;
  /** If true, forces step mode even without branching logic */
  forceStepMode?: boolean;
  /** Callback fired when the visible step changes (receives 0-based visible index and estimated total reachable steps) */
  onStepChange?: (visibleStepIndex: number, totalVisibleSteps: number) => void;
}

export interface UseStepNavigationReturn {
  /** Whether step-based navigation is active (has branching or forceStepMode) */
  isStepMode: boolean;
  /** Current question index (-1 when no questions are visible) */
  currentStep: number;
  /** The current question to display (undefined when no visible questions exist) */
  currentQuestion: LumiSurveyQuestion | undefined;
  /** Whether the user can go back */
  canGoBack: boolean;
  /** Whether the user can go forward (has answered current question) */
  canGoNext: boolean;
  /** Whether this is the last question based on current path (includes branching SUBMIT) */
  isLastStep: boolean;
  /** Navigate to the next question based on branching logic */
  goToNext: () => BranchingResult | null;
  /** Navigate to the previous question in history */
  goToPrevious: () => void;
  /** Reset navigation to the first question */
  resetNavigation: () => void;
  /** Whether step navigation is driven by branching or explicitly forced */
  hasBranching: boolean;
  /** Array of visited question indices for back navigation */
  visitedSteps: number[];
  /** 0-based index among currently visible questions (-1 when none visible) */
  visibleStepIndex: number;
  /** Estimated total reachable steps along the current path */
  totalVisibleSteps: number;
}

/**
 * Hook that manages step-by-step navigation through a survey with branching.
 * Automatically enables step mode for logic or answer-dependent visibleIf
 * value operators; EXISTS-only progressive disclosure stays single-page.
 */
export function useStepNavigation(
  options: UseStepNavigationOptions,
): UseStepNavigationReturn {
  const {
    questions,
    answers,
    metadata,
    forceStepMode = false,
    onStepChange,
  } = options;

  // Determine if we need step-based navigation
  const hasLogicBranching = useMemo(
    () => surveyHasBranchingLogic(questions),
    [questions],
  );
  const hasVisibilityBranching = useMemo(
    () => surveyHasVisibilityBranching(questions),
    [questions],
  );
  const hasBranching =
    hasLogicBranching || hasVisibilityBranching || forceStepMode;
  const isStepMode = hasBranching;

  // Navigation state — start on the first visible question (skip any that are
  // hidden by visibleIf on initial render). Uses -1 when no questions are visible.
  const [currentStep, setCurrentStep] = useState(() =>
    findNextVisibleIndex(questions, answers, metadata, 0),
  );
  const [visitedSteps, setVisitedSteps] = useState<number[]>(() => {
    const firstVisible = findNextVisibleIndex(questions, answers, metadata, 0);
    return firstVisible === -1 ? [] : [firstVisible];
  });
  const currentQuestion = questions[currentStep];

  // Check if current question has been answered
  const currentAnswer = answers[currentQuestion?.id];
  const hasAnsweredCurrent = isAnswered(currentAnswer);

  const canGoBack = visitedSteps.length > 1;
  const canGoNext =
    !!currentQuestion && (hasAnsweredCurrent || !currentQuestion.required);

  // Shared branching evaluation — used by both isLastStep and goToNext.
  // Only computed when the current question has been answered, since branching
  // rules evaluate against the current answer.
  const branchingResult = useMemo(() => {
    if (!currentQuestion || !hasAnsweredCurrent) return null;
    return evaluateBranching(
      currentQuestion,
      currentAnswer,
      metadata,
      questions,
      currentStep,
      answers,
    );
  }, [
    currentQuestion,
    currentAnswer,
    metadata,
    questions,
    currentStep,
    hasAnsweredCurrent,
    answers,
  ]);

  // Determines whether the current step is the last one in the survey path.
  // Three cases make this true:
  // 1. Branching explicitly says SUBMIT (nextIndex === -1)
  // 2. Question is unanswered, and no later questions are reachable (visible
  //    now, or dependent on the current answer and thus potentially visible)
  // 3. Question is answered, and no visible questions exist after the
  //    branching-determined next index
  const isLastStep = useMemo(() => {
    if (!currentQuestion) return false;
    if (branchingResult?.nextIndex === -1) return true;

    if (!hasAnsweredCurrent) {
      // When the user hasn't answered yet, we can't evaluate branching rules.
      // Instead, check if any later question is currently visible OR depends on
      // this question's answer (meaning it could become visible once answered).
      return !hasReachableQuestionsAfter(
        questions,
        currentStep,
        currentQuestion.id,
        answers,
        metadata,
      );
    }

    // Question is answered — use branching result to determine where we'd go
    // next, then check if any visible question exists from that point forward.
    const nextStartIndex = branchingResult
      ? Math.max(0, branchingResult.nextIndex)
      : currentStep + 1;

    return (
      findNextVisibleIndex(questions, answers, metadata, nextStartIndex) === -1
    );
  }, [
    currentQuestion,
    currentStep,
    branchingResult,
    hasAnsweredCurrent,
    questions,
    answers,
    metadata,
  ]);

  // Compute step metrics for progress reporting.
  // visibleStepIndex is the 0-based position among currently visible questions.
  const reachableSteps = useMemo(
    () => computeReachableSteps(questions, answers, metadata),
    [questions, answers, metadata],
  );
  // Snapshot reachable steps for navigation handlers to avoid stale closures
  // without adding answer-driven dependencies to callbacks.
  const reachableStepsRef = useRef(reachableSteps);
  reachableStepsRef.current = reachableSteps;

  // Progress-bar total that only updates during navigation transitions.
  const [displayedTotal, setDisplayedTotal] = useState(reachableSteps);
  const totalVisibleSteps = displayedTotal;
  const visibleStepIndex = useMemo(() => {
    if (currentStep < 0) return -1;
    let count = 0;
    for (let i = 0; i < currentStep; i++) {
      if (evaluateVisibility(questions[i].visibleIf, answers, metadata)) {
        count++;
      }
    }
    return count;
  }, [currentStep, questions, answers, metadata]);

  // Fire onStepChange when the user actually moves to a different step.
  // Uses a ref to avoid spurious re-fires when onStepChange reference changes.
  const prevStepRef = useRef<number | null>(null);
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  // Sync progress total when a different survey definition is loaded.
  const previousQuestionsRef = useRef(questions);
  useEffect(() => {
    if (previousQuestionsRef.current === questions) return;
    previousQuestionsRef.current = questions;
    setDisplayedTotal(reachableSteps);
  }, [questions, reachableSteps]);

  useEffect(() => {
    if (!isStepMode || currentStep < 0) return;
    if (prevStepRef.current === currentStep) return;
    prevStepRef.current = currentStep;
    onStepChangeRef.current?.(visibleStepIndex, totalVisibleSteps);
  }, [currentStep, isStepMode, visibleStepIndex, totalVisibleSteps]);

  const goToNext = useCallback(() => {
    if (!currentQuestion) return null;
    // Guard: don't advance if the current question is required and unanswered
    if (currentQuestion.required && !hasAnsweredCurrent) return null;

    // Evaluate branching rules to get the raw next index. This may point to a
    // hidden question, so we scan forward to find the first visible one.
    const result =
      branchingResult ??
      evaluateBranching(
        currentQuestion,
        currentAnswer,
        metadata,
        questions,
        currentStep,
        answers,
      );

    if (result.nextIndex === -1) {
      // SUBMIT action triggered — no navigation, consumer handles submission
      return result;
    }

    // Clamp to valid range, then scan for next visible question
    const nextStartIndex = Math.max(0, result.nextIndex);
    const nextVisibleIndex = findNextVisibleIndex(
      questions,
      answers,
      metadata,
      nextStartIndex,
    );

    // No visible questions ahead — signal submit to the consumer
    if (nextVisibleIndex === -1) {
      return { ...result, nextIndex: -1 };
    }

    // Navigate and record in history. If we revisit an earlier step (e.g. via
    // JUMP_TO), truncate history to avoid loops like [0,1,2,1,0,1,2].
    if (nextVisibleIndex !== currentStep) {
      setCurrentStep(nextVisibleIndex);
      setVisitedSteps((prev) => {
        const existingIndex = prev.indexOf(nextVisibleIndex);
        if (existingIndex !== -1) return prev.slice(0, existingIndex + 1);
        return [...prev, nextVisibleIndex];
      });
      setDisplayedTotal(reachableStepsRef.current);
    }

    // Return the actual navigation target so the consumer knows where we went
    return { ...result, nextIndex: nextVisibleIndex };
  }, [
    currentQuestion,
    currentAnswer,
    hasAnsweredCurrent,
    metadata,
    questions,
    currentStep,
    branchingResult,
    answers,
  ]);

  // Navigate backward through visited history, skipping any steps that have
  // become hidden since they were visited (e.g. because the user changed an
  // earlier answer that affected visibleIf conditions).
  const goToPrevious = useCallback(() => {
    if (visitedSteps.length <= 1) return;

    // Remove current step and search backward for a still-visible step
    const previousHistory = visitedSteps.slice(0, -1);
    const result = findLastVisibleInHistory(
      previousHistory,
      questions,
      answers,
      metadata,
    );

    if (result) {
      setVisitedSteps(result.history);
      setCurrentStep(result.step);
      setDisplayedTotal(reachableStepsRef.current);
      return;
    }

    // No visited steps are visible — fall back to first visible question
    const firstVisible = findNextVisibleIndex(questions, answers, metadata, 0);
    if (firstVisible === -1) return;
    setVisitedSteps([firstVisible]);
    setCurrentStep(firstVisible);
    setDisplayedTotal(reachableStepsRef.current);
  }, [visitedSteps, questions, answers, metadata]);

  // Reset to the beginning — used when the survey definition changes or
  // the consumer explicitly wants to start over.
  const resetNavigation = useCallback(() => {
    const firstVisible = findNextVisibleIndex(questions, answers, metadata, 0);
    setCurrentStep(firstVisible);
    setVisitedSteps(firstVisible === -1 ? [] : [firstVisible]);
    setDisplayedTotal(reachableStepsRef.current);
  }, [questions, answers, metadata]);

  // Auto-navigation effect: handles two scenarios:
  // 1. Current step is -1 (no visible questions) but questions have since become
  //    visible (e.g. metadata arrived async) → navigate to first visible.
  // 2. Current step became invisible (e.g. user went back and changed an answer
  //    that affected a visibleIf condition) → redirect to best available step,
  //    or fall back to -1 if nothing is visible anymore.
  useEffect(() => {
    if (!isStepMode) return;

    // Recovery: no current question — try to find one
    if (!currentQuestion) {
      const firstVisible = findNextVisibleIndex(
        questions,
        answers,
        metadata,
        0,
      );
      if (firstVisible === -1) return;
      setCurrentStep(firstVisible);
      setVisitedSteps([firstVisible]);
      setDisplayedTotal(reachableStepsRef.current);
      return;
    }

    // Current step is still visible — nothing to do
    if (evaluateVisibility(currentQuestion.visibleIf, answers, metadata))
      return;

    const target = findRedirectTarget(
      questions,
      answers,
      metadata,
      currentStep,
      visitedSteps,
    );

    // All questions became hidden — enter no-visible state
    if (target === -1) {
      setCurrentStep(-1);
      setVisitedSteps([]);
      return;
    }

    if (target === currentStep) return;

    setCurrentStep(target);
    setVisitedSteps((prev) => {
      const existingIndex = prev.indexOf(target);
      if (existingIndex !== -1) return prev.slice(0, existingIndex + 1);
      return [...prev, target];
    });
    setDisplayedTotal(reachableStepsRef.current);
  }, [
    isStepMode,
    currentQuestion,
    questions,
    answers,
    metadata,
    currentStep,
    visitedSteps,
  ]);

  return {
    isStepMode,
    currentStep,
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
    totalVisibleSteps,
  };
}
