import type React from "react";
import type { LumiSurveyQuestion } from "../../core";

export interface StepNavigationProps {
  isStepMode?: boolean;
  currentStep?: number;
  currentStepQuestion?: LumiSurveyQuestion;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLastStep?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
}

export interface ProgressProps {
  showProgress?: boolean;
  totalSteps?: number;
  hasBranching?: boolean;
  hasIntro?: boolean;
}

export interface QuestionContextProps {
  promptQuestionId: string;
  promptHeadingId: string;
  promptDescriptionId?: string;
  validationErrorMessage: string;
}

export interface IntroProps {
  isIntro?: boolean;
  introTitle?: string;
  introBody?: React.ReactNode;
  introStartLabel?: string;
  onIntroStart?: () => void;
}

export interface SuccessProps {
  isSuccess: boolean;
  successTitle: string;
  successBody?: React.ReactNode;
  successPrimaryLabel: string;
}
