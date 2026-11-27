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
import { getAnswerValidationIssue } from "../../../core/validation.js";
import type { CanonicalSurveyPage } from "../../shared/canonicalSurvey.js";
import {
  DEFAULT_COPY,
  DEFAULT_PERSONAL_DATA_NOTICE,
} from "../../shared/commonDefaults.js";
import { SurveyFormlessProvider } from "../../shared/surveyFormOwner.js";
import { useSurveyHeadingLevel } from "../../shared/surveyHeadingLevel.js";
import {
  BuiltInText,
  builtInCopyLang,
  QuestionPrompt,
  useSurveyLang,
} from "../../shared/surveyLanguage.js";
import { type SurveyTree, treeOf } from "../../shared/surveyTree.js";

const DEFAULT_NEXT_LABEL = "Neste";
const DEFAULT_BACK_LABEL = "Tilbake";

/** Marks the button that sends the answers. */
export const SUBMIT_BUTTON_ATTRIBUTE = "data-lumi-survey-submit";

import { ownValue } from "../../../core/ownValue.js";
import { CLASS_NAMES } from "../classNames.js";
import type {
  ProgressProps,
  QuestionContextProps,
  StepNavigationProps,
} from "../dockTypes.js";
import { DockQuestionRenderer } from "./DockQuestionRenderer.js";

interface SurveyFormContentProps {
  // Form
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  /**
   * Render the questions without a `<form>` element, and submit from the
   * button. An inline survey can sit inside a form the app owns, where a
   * nested form is invalid HTML and a submit button would submit the app's
   * form.
   */
  formless?: boolean;
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

/**
 * The fields in a `<form>`, or without a form owner when the survey is
 * formless.
 */
const FieldsContainer = ({
  formless,
  onSubmit,
  children,
}: {
  formless: boolean;
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => Promise<void>;
  children: React.ReactNode;
}) =>
  formless ? (
    <SurveyFormlessProvider value>{children}</SurveyFormlessProvider>
  ) : (
    <form onSubmit={onSubmit} noValidate>
      {children}
    </form>
  );

function focusQuestionField(tree: SurveyTree, anchorId: string) {
  const question = tree.getElementById(anchorId);
  const field = question?.querySelector<HTMLElement>(
    "input, textarea, select, button",
  );
  (field ?? question)?.focus();
}

export const SurveyFormContent = React.memo(
  ({
    onSubmit,
    formless = false,
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
    const surveyLang = useSurveyLang();
    const headingLevel = useSurveyHeadingLevel();
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
      nextLabel = DEFAULT_NEXT_LABEL,
      backLabel = DEFAULT_BACK_LABEL,
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
      questionAnchorId,
      validationErrorMessage,
      validationSummaryHeading,
      textTooLongErrorMessage,
    } = questionContext;
    const currentStepNumber = currentStep + 1;
    const stepStatus = hasBranching
      ? `Steg ${currentStepNumber}`
      : `Steg ${currentStepNumber} av ${totalSteps}`;
    // Built-in copy is marked as Bokmål; text the app replaced inherits the
    // page language.
    const submitText = isSubmitting ? submitPendingLabel : submitLabel;
    const submitLang = builtInCopyLang(
      isSubmitting
        ? submitPendingLabel === DEFAULT_COPY.submitPendingLabel
        : submitLabel === DEFAULT_COPY.submitLabel,
    );
    const noticeLang = builtInCopyLang(
      personalDataNoticeBody === DEFAULT_PERSONAL_DATA_NOTICE,
    );
    const transportErrorLang = builtInCopyLang(
      transportErrorMessage === DEFAULT_COPY.transportErrorMessage,
    );
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

    // Without a form there is no submit event, so the button submits. The
    // marker lets the survey return focus to the button after a failed submit.
    const submitButtonProps = formless
      ? ({
          type: "button",
          [SUBMIT_BUTTON_ATTRIBUTE]: "",
          onClick: () => {
            void onSubmit();
          },
        } as const)
      : ({ type: "submit", [SUBMIT_BUTTON_ATTRIBUTE]: "" } as const);

    const errorSummaryRef = useRef<HTMLDivElement>(null);
    // An element that is always rendered, to find the document or the shadow
    // tree the survey is in.
    const fieldsRef = useRef<HTMLDivElement>(null);
    const validationMissingRef = useRef(validationMissing);
    validationMissingRef.current = validationMissing;
    const questionAnchorIdRef = useRef(questionAnchorId);
    questionAnchorIdRef.current = questionAnchorId;
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
      focusQuestionField(
        treeOf(fieldsRef.current),
        questionAnchorIdRef.current(missing[0]),
      );
    }, [validationAttempt]);

    const renderQuestion = (
      question: LumiSurveyQuestion,
      hideLabel: boolean,
    ) => {
      const isMissing = validationMissing.includes(question.id);
      return (
        <div
          key={question.id}
          id={questionAnchorId(question.id)}
          className={CLASS_NAMES.question}
          tabIndex={-1}
        >
          <DockQuestionRenderer
            question={question}
            value={ownValue(answers, question.id)}
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
            textTooLongErrorMessage={textTooLongErrorMessage}
          />
        </div>
      );
    };

    const errorSummary = validationMissing.length > 1 && (
      <ErrorSummary
        ref={errorSummaryRef}
        size="small"
        headingTag={`h${headingLevel}`}
        heading={
          <BuiltInText
            isDefault={
              validationSummaryHeading === DEFAULT_COPY.validationSummaryHeading
            }
          >
            {validationSummaryHeading}
          </BuiltInText>
        }
      >
        {validationMissing.map((questionId) => {
          const question = orderedQuestions.find(
            (candidate) => candidate.id === questionId,
          );
          const issue = question
            ? getAnswerValidationIssue(question, ownValue(answers, questionId))
            : undefined;
          const questionLabel = question ? (
            <QuestionPrompt question={question} />
          ) : (
            <BuiltInText
              isDefault={
                validationErrorMessage === DEFAULT_COPY.validationErrorMessage
              }
            >
              {validationErrorMessage}
            </BuiltInText>
          );
          return (
            <ErrorSummary.Item
              key={questionId}
              href={`#${questionAnchorId(questionId)}`}
              onClick={(event) => {
                event.preventDefault();
                focusQuestionField(
                  treeOf(event.currentTarget),
                  questionAnchorId(questionId),
                );
              }}
            >
              {questionLabel}
              {issue?.type === "textTooLong" && (
                <>
                  {": "}
                  <BuiltInText
                    isDefault={
                      textTooLongErrorMessage ===
                      DEFAULT_COPY.textTooLongErrorMessage
                    }
                  >
                    {textTooLongErrorMessage(issue.maxLength)}
                  </BuiltInText>
                </>
              )}
            </ErrorSummary.Item>
          );
        })}
      </ErrorSummary>
    );

    return (
      <>
        {showProgress &&
          isStepMode &&
          currentStep >= 0 &&
          (hasBranching || totalSteps > 1) && (
            <VStack gap="space-4" lang={builtInCopyLang(true)}>
              <BodyShort size="small" aria-hidden>
                {stepStatus}
              </BodyShort>
              {!hasBranching && (
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

        <FieldsContainer formless={formless} onSubmit={onSubmit}>
          <VStack ref={fieldsRef} gap="space-16">
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
                  <Alert variant="warning" role="status" lang={noticeLang}>
                    {personalDataNoticeBody}
                  </Alert>
                )}

                {hasTransportError && (
                  <Alert variant="error" role="alert" lang={transportErrorLang}>
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
                      lang={builtInCopyLang(backLabel === DEFAULT_BACK_LABEL)}
                    >
                      {backLabel}
                    </Button>
                  )}
                  {isLastStep ? (
                    <Button
                      key="submit-btn"
                      {...submitButtonProps}
                      lang={submitLang}
                      loading={isSubmitting}
                      disabled={
                        isSubmitting || (disableWhenIncomplete && !canGoNext)
                      }
                    >
                      {submitText}
                    </Button>
                  ) : (
                    <Button
                      key="next-btn"
                      type="button"
                      // Next sends the survey when no later question is shown,
                      // so focus returns here after a failed send.
                      {...{ [SUBMIT_BUTTON_ATTRIBUTE]: "" }}
                      lang={builtInCopyLang(nextLabel === DEFAULT_NEXT_LABEL)}
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
                          // Same authored construct as the panel header, so
                          // it gets the same title typography and the same
                          // group boundary wherever it lands.
                          <VStack
                            gap="space-4"
                            className={CLASS_NAMES.groupHeader}
                          >
                            {page.title && (
                              <Heading
                                level={headingLevel}
                                size="small"
                                lang={surveyLang}
                              >
                                {page.title}
                              </Heading>
                            )}
                            {page.description && (
                              <BodyShort size="small" lang={surveyLang}>
                                {page.description}
                              </BodyShort>
                            )}
                          </VStack>
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
                  <Alert variant="warning" role="status" lang={noticeLang}>
                    {personalDataNoticeBody}
                  </Alert>
                )}

                <HStack gap="space-8" wrap>
                  <Button
                    {...submitButtonProps}
                    lang={submitLang}
                    loading={isSubmitting}
                    disabled={isSubmitBlocked || isSubmitting}
                  >
                    {submitText}
                  </Button>
                </HStack>

                {hasTransportError && (
                  <Alert variant="error" role="alert" lang={transportErrorLang}>
                    {transportErrorMessage}
                  </Alert>
                )}
              </>
            )}
          </VStack>
        </FieldsContainer>
      </>
    );
  },
);

SurveyFormContent.displayName = "SurveyFormContent";
