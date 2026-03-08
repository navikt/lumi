import { Alert, Button, HStack, ProgressBar, VStack } from "@navikt/ds-react";
import React, { useCallback, useRef } from "react";
import type { LumiSurveyAnswerValue, LumiSurveyQuestion } from "../../../core";
import { DockQuestionRenderer } from "./DockQuestionRenderer.js";

interface SurveyFormContentProps {
  // Form
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
  isSubmitBlocked: boolean;
  submitLabel: string;
  submitPendingLabel: string;

  // Questions
  orderedQuestions: LumiSurveyQuestion[];
  answers: Record<string, LumiSurveyAnswerValue>;
  onQuestionChange: (
    questionId: string,
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
  promptQuestionId: string;
  promptHeadingId: string;
  promptDescriptionId?: string;
  validationMissing: string[];
  validationErrorMessage: string;

  // Step navigation
  isStepMode: boolean;
  currentStepQuestion?: LumiSurveyQuestion;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel: string;
  backLabel: string;

  // Progress
  showProgress: boolean;
  currentStep: number;
  totalSteps: number;
  hasBranching: boolean;

  // Notices
  showPersonalDataNotice: boolean;
  personalDataNoticeBody?: React.ReactNode;
  hasTransportError: boolean;
  transportErrorMessage: string;

  // Misc
  disabled: boolean;
}

export const SurveyFormContent = React.memo(
  ({
    onSubmit,
    isSubmitting,
    isSubmitBlocked,
    submitLabel,
    submitPendingLabel,
    orderedQuestions,
    answers,
    onQuestionChange,
    promptQuestionId,
    promptHeadingId,
    promptDescriptionId,
    validationMissing,
    validationErrorMessage,
    isStepMode,
    currentStepQuestion,
    canGoBack,
    canGoNext,
    isLastStep,
    onNext,
    onBack,
    nextLabel,
    backLabel,
    showProgress,
    currentStep,
    totalSteps,
    hasBranching,
    showPersonalDataNotice,
    personalDataNoticeBody,
    hasTransportError,
    transportErrorMessage,
    disabled,
  }: SurveyFormContentProps) => {
    // Stable onChange handlers per question-id so React.memo on
    // DockQuestionRenderer can skip re-renders when props haven't changed.
    const onQuestionChangeRef = useRef(onQuestionChange);
    onQuestionChangeRef.current = onQuestionChange;

    const handlersRef = useRef(
      new Map<
        string,
        (value: LumiSurveyAnswerValue | null | undefined) => void
      >(),
    );

    const getChangeHandler = useCallback((questionId: string) => {
      let handler = handlersRef.current.get(questionId);
      if (!handler) {
        handler = (value: LumiSurveyAnswerValue | null | undefined) => {
          onQuestionChangeRef.current(questionId, value);
        };
        handlersRef.current.set(questionId, handler);
      }
      return handler;
    }, []);

    return (
      <>
        {showProgress && isStepMode && totalSteps > 0 && (
          <ProgressBar
            value={currentStep + 1}
            valueMax={totalSteps}
            size="small"
            aria-label={
              hasBranching
                ? `Steg ${currentStep + 1}`
                : `Steg ${currentStep + 1} av ${totalSteps}`
            }
          />
        )}

        <form onSubmit={onSubmit} noValidate>
          <VStack gap="space-16">
            {isStepMode && currentStepQuestion ? (
              // Step mode: Show only the current question
              <>
                <div className="lumi-survey-question">
                  <DockQuestionRenderer
                    question={currentStepQuestion}
                    value={answers[currentStepQuestion.id]}
                    onChange={getChangeHandler(currentStepQuestion.id)}
                    isMissing={validationMissing.includes(
                      currentStepQuestion.id,
                    )}
                    disabled={disabled}
                    hideLabel
                    promptQuestionId={promptQuestionId}
                    promptHeadingId={promptHeadingId}
                    promptDescriptionId={promptDescriptionId}
                    validationErrorMessage={validationErrorMessage}
                  />
                </div>

                {/* Show privacy notice when a text field is visible */}
                {showPersonalDataNotice && (
                  <Alert variant="warning" role="alert">
                    {personalDataNoticeBody}
                  </Alert>
                )}

                {hasTransportError && (
                  <Alert variant="error" role="alert">
                    {transportErrorMessage}
                  </Alert>
                )}

                <HStack gap="space-8" wrap>
                  {canGoBack && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={onBack}
                      disabled={isSubmitting}
                    >
                      {backLabel}
                    </Button>
                  )}
                  {isLastStep ? (
                    <Button
                      key="submit-btn"
                      type="submit"
                      loading={isSubmitting}
                      disabled={isSubmitting || !canGoNext}
                    >
                      {isSubmitting ? submitPendingLabel : submitLabel}
                    </Button>
                  ) : (
                    <Button
                      key="next-btn"
                      type="button"
                      onClick={onNext}
                      disabled={isSubmitting || !canGoNext}
                    >
                      {nextLabel}
                    </Button>
                  )}
                </HStack>
              </>
            ) : (
              // All visible questions mode
              <>
                {orderedQuestions.map((question) => {
                  const value = answers[question.id];
                  const isMissing = validationMissing.includes(question.id);

                  return (
                    <div key={question.id} className="lumi-survey-question">
                      <DockQuestionRenderer
                        question={question}
                        value={value}
                        onChange={getChangeHandler(question.id)}
                        isMissing={isMissing}
                        disabled={disabled}
                        hideLabel={question.id === promptQuestionId}
                        promptQuestionId={promptQuestionId}
                        promptHeadingId={promptHeadingId}
                        promptDescriptionId={promptDescriptionId}
                        validationErrorMessage={validationErrorMessage}
                      />
                    </div>
                  );
                })}

                {showPersonalDataNotice && (
                  <Alert variant="warning" role="alert">
                    {personalDataNoticeBody}
                  </Alert>
                )}

                <HStack gap="space-8" wrap>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={isSubmitBlocked || isSubmitting}
                  >
                    {isSubmitting ? submitPendingLabel : submitLabel}
                  </Button>
                </HStack>

                {hasTransportError && (
                  <Alert variant="error" role="alert">
                    {transportErrorMessage}
                  </Alert>
                )}
              </>
            )}
          </VStack>
        </form>
      </>
    );
  },
);

SurveyFormContent.displayName = "SurveyFormContent";
