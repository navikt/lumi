import type React from "react";
import { useCallback, useMemo } from "react";
import type {
  LumiSurveyContext,
  LumiSurveyEvents,
  LumiSurveyTransport,
  RatingQuestion,
} from "../../core";
import {
  getVisibleQuestions,
  shouldShowSubmitButton,
  useLumiSurvey,
} from "../../core";
import { surveyHasBranchingLogic } from "../../core/branchingEngine.js";
import type { LumiSurveyRenderQuestionProps } from "../../types.js";
import { DefaultQuestionRenderer, RatingQuestionField } from "../questions";
import { buildCanonicalSurvey } from "../shared/canonicalSurvey.js";
import type { LumiSurveyConfig } from "../surveyTypes.js";
import { CLASS_NAMES, joinClassNames } from "./classNames.js";
import { DockPanel } from "./components/DockPanel.js";
import { MinimizedDock } from "./components/MinimizedDock.js";
import { useAutoCloseOnSuccess } from "./hooks/useAutoCloseOnSuccess.js";
import { useEnrichedContext } from "./hooks/useEnrichedContext.js";
import { usePersistedDismissal } from "./hooks/usePersistedDismissal.js";
import { useStepNavigation } from "./hooks/useStepNavigation.js";
import { resolveConfig } from "./resolveConfig.js";
import "./LumiSurveyDock.fallback.css";

import type {
  LumiSurveyBehavior,
  LumiSurveyLabels,
  LumiSurveyStyle,
  LumiSurveySuccessConfig,
} from "./propTypes.js";

/**
 * Props for the LumiSurveyDock component.
 *
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   surveyId="my-app"
 *   survey={NAV_STANDARD_RATING}
 *   transport={transport}
 *   labels={{ submit: "Send", cancel: "Avbryt" }}
 *   success={{ title: "Takk!", autoClose: true }}
 *   behavior={{ storageStrategy: "localStorage" }}
 * />
 * ```
 */
export interface LumiSurveyDockProps {
  /**
   * Unique identifier for this feedback instance. Used for localStorage persistence keys and event tracking.
   * @example "oppfolgingsplan-feedback"
   */
  surveyId: string;

  /**
   * Survey configuration defining the questions to display.
   * Use presets like NAV_STANDARD_RATING or create custom with createRatingSurvey().
   */
  survey: LumiSurveyConfig;

  /**
   * Transport implementation for submitting feedback data.
   * Receives the formatted submission payload and returns a promise.
   */
  transport: LumiSurveyTransport;

  /**
   * Labels for UI elements (submit button, error messages, etc.).
   */
  labels?: LumiSurveyLabels;

  /**
   * Success state configuration (title, body, auto-close).
   */
  success?: LumiSurveySuccessConfig;

  /**
   * Visual styling options (position, colors, classNames).
   */
  style?: LumiSurveyStyle;

  /**
   * Behavior options (persistence, cooldown, privacy notice).
   */
  behavior?: LumiSurveyBehavior;

  /**
   * Optional event callbacks for tracking user interactions and lifecycle events.
   */
  events?: LumiSurveyEvents;

  /**
   * Structured context for segmentation (tags) and debugging (debug).
   * System fields (url, pathname, viewport, deviceType) are auto-collected.
   */
  context?: LumiSurveyContext;
}

export const LumiSurveyDock = ({
  surveyId,
  survey,
  transport,
  events,
  context,
  labels,
  success,
  style,
  behavior,
}: LumiSurveyDockProps) => {
  // Resolve all config with defaults
  const config = useMemo(
    () => resolveConfig(labels, success, style, behavior),
    [labels, success, style, behavior],
  );

  // IMPORTANT: Call all hooks before any conditional returns to comply with Rules of Hooks

  /*
   * Use the new flexible survey builder.
   * "questions" is the full list of questions in display order.
   */
  const canonicalSurvey = useMemo(() => buildCanonicalSurvey(survey), [survey]);
  const { type: surveyType, questions } = canonicalSurvey;

  // Check if survey has any text questions (for personal data notice)
  const hasTextQuestions = useMemo(
    () => questions.some((q) => q.type === "text"),
    [questions],
  );

  // The first question is used as the "prompt" question in the header
  const promptQuestion = questions[0];

  const promptHeadingId = `${promptQuestion.id}-dock-heading`;
  const promptDescriptionId = promptQuestion.description
    ? `${promptQuestion.id}-dock-description`
    : undefined;
  const successHeadingId = `${surveyId}-dock-success-heading`;
  const panelId = `${surveyId}-dock-panel`;

  // Auto-collect system context and merge with user-provided context
  const enrichedContext = useEnrichedContext(context);

  const { answers, status, error, setAnswer, submit, reset } = useLumiSurvey({
    surveyId,
    questions,
    transport,
    events,
    context: enrichedContext,
    surveyType,
  });

  const { dismissed, shouldHideCompletely, isLoading, closeDock, reopenDock } =
    usePersistedDismissal({
      surveyId,
      initialOpen: config.initialOpen,
      dismissCooldownDays: config.dismissCooldownDays,
      events,
      resetOnClose: config.resetOnClose,
      onReset: reset,
      storageStrategy: config.storageStrategy,
    });

  // Filter questions based on visibleIf conditions (progressive disclosure)
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questions, answers, enrichedContext?.tags),
    [questions, answers, enrichedContext?.tags],
  );

  // Hide submit until first required question has an answer
  const isSubmitBlocked = useMemo(
    () => !shouldShowSubmitButton(questions, answers),
    [questions, answers],
  );

  // Step navigation for branching logic
  const hasBranching = useMemo(
    () => surveyHasBranchingLogic(questions),
    [questions],
  );

  const forceStepMode = config.questionLayout === "steps";
  const forceSinglePage = config.questionLayout === "singlePage";

  const {
    isStepMode: stepModeFromSurvey,
    currentStep,
    currentQuestion: currentStepQuestion,
    visitedSteps,
    canGoBack,
    canGoNext,
    isLastStep,
    shouldSubmit,
    goToNext,
    goToPrevious,
  } = useStepNavigation({
    questions,
    answers,
    forceStepMode,
  });

  // "singlePage" is only meaningful when there is no branching.
  // If branching exists we keep step mode to preserve correct navigation.
  const isStepMode = forceSinglePage ? hasBranching : stepModeFromSurvey;

  const hasTextQuestionsForNotice = useMemo(() => {
    if (!isStepMode) {
      return hasTextQuestions;
    }

    const indices = new Set<number>([...visitedSteps, currentStep]);
    for (const index of indices) {
      if (questions[index]?.type === "text") {
        return true;
      }
    }

    return false;
  }, [currentStep, hasTextQuestions, isStepMode, questions, visitedSteps]);

  const handleNext = useCallback(async () => {
    const result = goToNext();
    if (!result || result.nextIndex !== -1) {
      return;
    }

    // If a privacy notice is relevant for this path, keep the existing confirm step:
    // first click shows the notice + "Send" button, second click submits.
    if (config.showPersonalDataNotice && hasTextQuestionsForNotice) {
      return;
    }

    try {
      await submit();
    } catch {
      // useLumiSurvey sets error state; avoid unhandled rejections
    }
  }, [
    config.showPersonalDataNotice,
    hasTextQuestionsForNotice,
    goToNext,
    submit,
  ]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await submit();
    },
    [submit],
  );

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";

  const handleCloseDock = useCallback(() => {
    if (isSuccess && config.hideAfterSubmit) {
      closeDock(true);
    } else {
      closeDock();
    }
  }, [closeDock, isSuccess, config.hideAfterSubmit]);

  useAutoCloseOnSuccess({
    enabled: config.autoCloseOnSuccess,
    status,
    delayMs: config.successCloseDelayMs,
    onClose: handleCloseDock,
  });
  const validationMissing = error?.type === "validation" ? error.missing : [];
  const hasTransportError = error?.type === "transport";

  const baseContainerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: config.offset,
    right: config.position === "bottom-right" ? config.offset : undefined,
    left: config.position === "bottom-left" ? config.offset : undefined,
    zIndex: 1000,
  };

  const isNpsDock =
    promptQuestion.type === "rating" &&
    (promptQuestion as RatingQuestion).variant === "nps";

  const openWidthRem = isNpsDock ? 32 : 24;

  const containerStyle: React.CSSProperties = dismissed
    ? baseContainerStyle
    : {
        ...baseContainerStyle,
        width: `min(${openWidthRem}rem, calc(100vw - ${config.offset * 2}px))`,
      };

  const panelStyle: React.CSSProperties = {
    maxHeight: "calc(100vh - 2rem)",
    overflowY: "auto",
  };

  const defaultQuestionRenderer = useCallback(
    (props: LumiSurveyRenderQuestionProps) => {
      /**
       * Special rendering for the rating question type.
       * Can now be any question in the list, but we keep the special UI for it.
       */
      if (props.question.type === "rating") {
        const rating = props.question as RatingQuestion;
        const isPromptQuestion = props.question.id === promptQuestion.id;
        const shouldHideInternalHeading =
          Boolean(props.hideLabel) || isPromptQuestion;

        return (
          <div className={CLASS_NAMES.ratingSection}>
            <div className={CLASS_NAMES.ratingField}>
              <RatingQuestionField
                question={rating}
                value={props.value}
                onChange={props.onChange}
                validationErrorMessage={config.validationErrorMessage}
                isMissing={props.isMissing}
                disabled={props.disabled}
                fieldsetClassName={CLASS_NAMES.ratingFieldset}
                hidePrompt={shouldHideInternalHeading}
                hideDescription={shouldHideInternalHeading}
                hideValueLabels
                wrap={false}
                ariaLabelledBy={
                  shouldHideInternalHeading ? promptHeadingId : undefined
                }
                ariaDescribedBy={
                  shouldHideInternalHeading ? promptDescriptionId : undefined
                }
                rowClassName={CLASS_NAMES.ratingRow}
                buttonClassName={CLASS_NAMES.ratingButton}
                fieldsetPaddingBlock="space-8"
                fieldsetPaddingInline="space-0"
              />
            </div>
          </div>
        );
      }

      return (
        <DefaultQuestionRenderer
          question={props.question}
          value={props.value}
          onChange={props.onChange}
          isMissing={props.isMissing}
          disabled={props.disabled}
          validationErrorMessage={config.validationErrorMessage}
          hideLabel={props.hideLabel}
        />
      );
    },
    [
      promptDescriptionId,
      promptHeadingId,
      promptQuestion.id,
      config.validationErrorMessage,
    ],
  );

  const noticeContent = config.personalDataNotice;

  // Don't render anything while loading persisted state
  if (isLoading) {
    return null;
  }

  // Don't render anything when dismissed with hideCompletely flag
  if (dismissed && shouldHideCompletely) {
    return null;
  }

  return (
    <aside
      className={joinClassNames(
        CLASS_NAMES.container,
        config.containerClassName,
      )}
      style={containerStyle}
      data-feedback-id={surveyId}
      data-state={dismissed ? "dismissed" : "open"}
      aria-label="Tilbakemeldingspanel"
    >
      {dismissed ? (
        <MinimizedDock
          label={config.minimizedButtonLabel}
          panelId={panelId}
          onReopen={reopenDock}
          className={CLASS_NAMES.minimizedButton}
        />
      ) : (
        <DockPanel
          panelId={panelId}
          panelLabel="Gi tilbakemelding"
          panelClassName={config.panelClassName}
          panelStyle={panelStyle}
          panelBackground={config.panelBackground}
          panelBorderColor={config.panelBorderColor}
          promptQuestion={promptQuestion}
          promptHeadingId={promptHeadingId}
          promptDescriptionId={promptDescriptionId}
          successHeadingId={successHeadingId}
          successTitle={config.successTitle}
          successBody={config.successBody}
          successPrimaryLabel={config.successPrimaryLabel}
          isSuccess={isSuccess}
          onClose={handleCloseDock}
          onSubmit={handleSubmit}
          orderedQuestions={visibleQuestions}
          answers={answers}
          renderQuestion={defaultQuestionRenderer}
          validationMissing={validationMissing}
          isSubmitting={isSubmitting}
          submitLabel={config.submitLabel}
          submitPendingLabel={config.submitPendingLabel}
          cancelLabel={config.cancelLabel}
          showPersonalDataNotice={
            config.showPersonalDataNotice && hasTextQuestionsForNotice
          }
          personalDataNotice={noticeContent}
          isSubmitBlocked={isSubmitBlocked}
          hasTransportError={Boolean(hasTransportError)}
          transportErrorMessage={config.transportErrorMessage}
          onQuestionChange={setAnswer}
          // Step mode props for branching
          isStepMode={isStepMode}
          currentStep={currentStep}
          currentStepQuestion={currentStepQuestion}
          canGoBack={canGoBack}
          canGoNext={canGoNext}
          isLastStep={isLastStep || shouldSubmit}
          onNext={handleNext}
          onBack={goToPrevious}
        />
      )}
    </aside>
  );
};

LumiSurveyDock.displayName = "LumiSurveyDock";
