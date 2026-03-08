import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BranchingResult,
  evaluateBranching,
  surveyHasBranchingLogic,
} from "../../../core/branchingEngine.js";
import type {
  LumiSurveyAnswerValue,
  LumiSurveyQuestion,
} from "../../../core/types.js";

export interface UseStepNavigationOptions {
  questions: LumiSurveyQuestion[];
  answers: Record<string, LumiSurveyAnswerValue>;
  metadata?: Record<string, unknown>;
  /** If true, forces step mode even without branching logic */
  forceStepMode?: boolean;
  /** Callback fired when the current step changes */
  onStepChange?: (currentStep: number, totalSteps: number) => void;
}

export interface UseStepNavigationReturn {
  /** Whether step-based navigation is active (has branching or forceStepMode) */
  isStepMode: boolean;
  /** Current question index */
  currentStep: number;
  /** The current question to display */
  currentQuestion: LumiSurveyQuestion;
  /** Whether the user can go back */
  canGoBack: boolean;
  /** Whether the user can go forward (has answered current question) */
  canGoNext: boolean;
  /** Whether this is the last question based on current path */
  isLastStep: boolean;
  /** Whether the current step should trigger submit (from branching) */
  shouldSubmit: boolean;
  /** Navigate to the next question based on branching logic */
  goToNext: () => BranchingResult | null;
  /** Navigate to the previous question in history */
  goToPrevious: () => void;
  /** Reset navigation to the first question */
  resetNavigation: () => void;
  /** Whether any question in the survey has branching logic */
  hasBranching: boolean;
  /** Array of visited question indices for back navigation */
  visitedSteps: number[];
  /** Get all questions that should be visible (for non-step mode) */
  getVisibleQuestions: () => LumiSurveyQuestion[];
}

/**
 * Hook that manages step-by-step navigation through a survey with branching logic.
 * Automatically enables step mode when any question has logic defined.
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
  const hasBranching = useMemo(
    () => surveyHasBranchingLogic(questions),
    [questions],
  );
  const isStepMode = hasBranching || forceStepMode;

  // Navigation state
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<number[]>([0]);
  const [shouldSubmit, setShouldSubmit] = useState(false);

  const currentQuestion = questions[currentStep];

  // Check if current question has been answered
  const currentAnswer = answers[currentQuestion?.id];
  const hasAnsweredCurrent =
    currentAnswer !== undefined &&
    currentAnswer !== null &&
    currentAnswer !== "" &&
    !(Array.isArray(currentAnswer) && currentAnswer.length === 0);

  const canGoBack = visitedSteps.length > 1;
  const canGoNext = hasAnsweredCurrent || !currentQuestion?.required;
  const isLastStep = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentStep >= questions.length - 1) return true;
    // Check if branching would trigger SUBMIT for current answer
    if (!hasAnsweredCurrent) return false;
    const result = evaluateBranching(
      currentQuestion,
      currentAnswer,
      metadata,
      questions,
      currentStep,
    );
    return result.nextIndex === -1;
  }, [
    currentQuestion,
    currentAnswer,
    metadata,
    questions,
    currentStep,
    hasAnsweredCurrent,
  ]);

  // Fire onStepChange when step changes
  useEffect(() => {
    if (isStepMode && onStepChange) {
      onStepChange(currentStep, questions.length);
    }
  }, [currentStep, isStepMode, onStepChange, questions.length]);

  const goToNext = useCallback(() => {
    if (!currentQuestion) return null;

    const result = evaluateBranching(
      currentQuestion,
      currentAnswer,
      metadata,
      questions,
      currentStep,
    );

    if (result.nextIndex === -1) {
      // SUBMIT action triggered
      setShouldSubmit(true);
      return result;
    }

    // Clamp to valid range
    const nextIndex = Math.min(
      Math.max(0, result.nextIndex),
      questions.length - 1,
    );

    // Only add to visited if we're going to a new step
    if (nextIndex !== currentStep) {
      setCurrentStep(nextIndex);
      setVisitedSteps((prev) => {
        const existingIndex = prev.indexOf(nextIndex);
        if (existingIndex !== -1) return prev.slice(0, existingIndex + 1);
        return [...prev, nextIndex];
      });
      setShouldSubmit(false);
    }

    return result;
  }, [currentQuestion, currentAnswer, metadata, questions, currentStep]);

  const goToPrevious = useCallback(() => {
    if (visitedSteps.length <= 1) return;

    // Remove current step from history and go to previous
    const newHistory = visitedSteps.slice(0, -1);
    const previousStep = newHistory[newHistory.length - 1];

    setVisitedSteps(newHistory);
    setCurrentStep(previousStep);
    setShouldSubmit(false);
  }, [visitedSteps]);

  const resetNavigation = useCallback(() => {
    setCurrentStep(0);
    setVisitedSteps([0]);
    setShouldSubmit(false);
  }, []);

  // For non-step mode: return all questions
  const getVisibleQuestions = useCallback(() => {
    return questions;
  }, [questions]);

  return {
    isStepMode,
    currentStep,
    currentQuestion,
    canGoBack,
    canGoNext,
    isLastStep,
    shouldSubmit,
    goToNext,
    goToPrevious,
    resetNavigation,
    hasBranching,
    visitedSteps,
    getVisibleQuestions,
  };
}
