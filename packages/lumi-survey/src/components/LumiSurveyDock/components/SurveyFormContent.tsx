import {
  Alert,
  BodyShort,
  Button,
  ErrorSummary,
  Heading,
  HStack,
  ProgressBar,
  VStack,
} from "@navikt/ds-react";
import React, { useCallback, useEffect, useRef } from "react";
import type { LumiSurveyAnswerValue, LumiSurveyQuestion } from "../../../core";
import { formatQuestionPrompt } from "../../questions/utils/formatQuestionPrompt.js";
import type { CanonicalSurveyPage } from "../../shared/canonicalSurvey.js";
import { CLASS_NAMES } from "../classNames.js";
import type {
  ProgressProps,
  QuestionContextProps,
  StepNavigationProps,
} from "../dockTypes.js";
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
  orderedPages?: CanonicalSurveyPage[];
  answers: Record<string, LumiSurveyAnswerValue>;
  onQuestionChange: (
    questionId: string,
    value: LumiSurveyAnswerValue | null | undefined,
  ) => void;
  validationMissing: string[];
  validationAttempt?: number;

  // Grouped props
  stepNavigation: StepNavigationProps;
  progress: ProgressProps;
  questionContext: QuestionContextProps;

  // Notices
  showPersonalDataNotice: boolean;
  personalDataNoticeBody?: React.ReactNode;
  hasTransportError: boolean;
  transportErrorMessage: string;

  // Misc
  disabled: boolean;
}

function focusQuestionField(anchorPrefix: string, questionId: string) {
  const question = document.getElementById(`${anchorPrefix}-${questionId}`);
  const field = question?.querySelector<HTMLElement>(
    "input, textarea, select, button",
  );
  (field ?? question)?.focus();
}

export const SurveyFormContent = React.memo(
  ({
    onSubmit,
    isSubmitting,
    isSubmitBlocked,
    submitLabel,
    submitPendingLabel,
    orderedQuestions,
    orderedPages,
    answers,
    onQuestionChange,
    validationMissing,
    validationAttempt = 0,
    stepNavigation,
    progress,
    questionContext,
    showPersonalDataNotice,
    personalDataNoticeBody,
    hasTransportError,
    transportErrorMessage,
    disabled,
  }: SurveyFormContentProps) => {
    // Destructure grouped props
    const {
      isStepMode = false,
      currentStep = 0,
      currentStepQuestion,
      currentStepQuestions,
      canGoBack = false,
      canGoNext = true,
      isLastStep = false,
      disableWhenIncomplete = true,
      onNext,
      onBack,
      nextLabel = "Neste",
      backLabel = "Tilbake",
    } = stepNavigation;

    const {
      showProgress = false,
      totalSteps = 0,
      hasBranching = false,
    } = progress;

    const {
      promptQuestionId,
      promptHeadingId,
      promptDescriptionId,
      promptDescriptionIsQuestionDescription,
      questionAnchorPrefix,
      validationErrorMessage,
    } = questionContext;
    const currentStepNumber = currentStep + 1;
    const stepStatus = hasBranching
      ? `Steg ${currentStepNumber}`
      : `Steg ${currentStepNumber} av ${totalSteps}`;
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

    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const validationMissingRef = useRef(validationMissing);
    validationMissingRef.current = validationMissing;
    const questionAnchorPrefixRef = useRef(questionAnchorPrefix);
    questionAnchorPrefixRef.current = questionAnchorPrefix;
    const previousValidationAttemptRef = useRef(validationAttempt);
    useEffect(() => {
      if (
        validationAttempt === 0 ||
        previousValidationAttemptRef.current === validationAttempt
      ) {
        return;
      }
      previousValidationAttemptRef.current = validationAttempt;
      const missing = validationMissingRef.current;
      if (missing.length > 1) {
        errorSummaryRef.current?.focus();
        return;
      }
      if (missing.length === 0) return;
      focusQuestionField(questionAnchorPrefixRef.current, missing[0]);
    }, [validationAttempt]);

    const renderQuestion = (
      question: LumiSurveyQuestion,
      hideLabel: boolean,
    ) => {
      const isMissing = validationMissing.includes(question.id);
      return (
        <div
          key={question.id}
          id={`${questionAnchorPrefix}-${question.id}`}
          className={CLASS_NAMES.question}
          tabIndex={-1}
        >
          <DockQuestionRenderer
            question={question}
            value={answers[question.id]}
            onChange={getChangeHandler(question.id)}
            isMissing={isMissing}
            disabled={disabled}
            hideLabel={hideLabel}
            promptQuestionId={promptQuestionId}
            promptHeadingId={promptHeadingId}
            promptDescriptionId={promptDescriptionId}
            promptDescriptionIsQuestionDescription={
              promptDescriptionIsQuestionDescription
            }
            validationErrorMessage={validationErrorMessage}
          />
        </div>
      );
    };

    const errorSummary = validationMissing.length > 1 && (
      <ErrorSummary
        ref={errorSummaryRef}
        size="small"
        heading="Du må svare på disse spørsmålene før du kan fortsette:"
      >
        {validationMissing.map((questionId) => {
          const question = orderedQuestions.find(
            (candidate) => candidate.id === questionId,
          );
          return (
            <ErrorSummary.Item
              key={questionId}
              href={`#${questionAnchorPrefix}-${questionId}`}
              onClick={(event) => {
                event.preventDefault();
                focusQuestionField(questionAnchorPrefix, questionId);
              }}
            >
              {question
                ? formatQuestionPrompt(question)
                : validationErrorMessage}
            </ErrorSummary.Item>
          );
        })}
      </ErrorSummary>
    );

    return (
      <>
        {showProgress && isStepMode && currentStep >= 0 && totalSteps > 1 && (
          <VStack gap="space-4">
            <BodyShort size="small" aria-hidden>
              {stepStatus}
            </BodyShort>
            {hasBranching ? (
              <ProgressBar
                value={currentStepNumber}
                valueMax={totalSteps}
                size="small"
                aria-hidden
              />
            ) : (
              <ProgressBar
                value={currentStepNumber}
                valueMax={totalSteps}
                size="small"
                aria-valuetext={stepStatus}
                aria-label="Fremdrift i undersøkelsen"
              />
            )}
            {hasBranching && (
              <BodyShort as="span" visuallyHidden>
                {`Fremdrift i undersøkelsen: ${stepStatus}`}
              </BodyShort>
            )}
          </VStack>
        )}

        <form onSubmit={onSubmit} noValidate>
          <VStack gap="space-16">
            {isStepMode && currentStepQuestion ? (
              // Step mode: Show all visible questions on the current page.
              <>
                {errorSummary}
                {(currentStepQuestions ?? [currentStepQuestion]).map(
                  (question) =>
                    renderQuestion(question, question.id === promptQuestionId),
                )}

                {/* Show privacy notice when a text field is visible */}
                {showPersonalDataNotice && (
                  <Alert variant="warning" role="status">
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
                      disabled={
                        isSubmitting || (disableWhenIncomplete && !canGoNext)
                      }
                    >
                      {isSubmitting ? submitPendingLabel : submitLabel}
                    </Button>
                  ) : (
                    <Button
                      key="next-btn"
                      type="button"
                      onClick={onNext}
                      disabled={
                        isSubmitting || (disableWhenIncomplete && !canGoNext)
                      }
                    >
                      {nextLabel}
                    </Button>
                  )}
                </HStack>
              </>
            ) : (
              // All visible questions mode
              <>
                {errorSummary}
                {orderedPages
                  ? orderedPages.map((page, pageIndex) => (
                      <VStack key={page.id} gap="space-12">
                        {pageIndex > 0 && (page.title || page.description) && (
                          <div>
                            {page.title && (
                              <Heading level="2" size="xsmall">
                                {page.title}
                              </Heading>
                            )}
                            {page.description && (
                              <BodyShort>{page.description}</BodyShort>
                            )}
                          </div>
                        )}
                        {page.questions.map((question) =>
                          renderQuestion(
                            question,
                            question.id === promptQuestionId,
                          ),
                        )}
                      </VStack>
                    ))
                  : orderedQuestions.map((question) =>
                      renderQuestion(
                        question,
                        question.id === promptQuestionId,
                      ),
                    )}

                {showPersonalDataNotice && (
                  <Alert variant="warning" role="status">
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
