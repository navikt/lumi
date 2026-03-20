"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LumiSurveyIntroConfig,
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
   * Optional intro screen configuration.
   * When set, an introduction screen is shown before the first question.
   */
  intro?: LumiSurveyIntroConfig;

  /**
   * Structured context for segmentation (tags) and debugging (debug).
   * System fields (viewport, deviceType, userAgent) are auto-collected.
   * Note: `deviceType` is derived from viewport width breakpoints (not the
   * physical device). If DevTools is open, the viewport may be narrower.
   *
   * Note: `url` is never auto-collected. `pathname` can be auto-collected if
   * `behavior.collectLocation` is enabled. Only use this if your routes do not
   * contain identifiers; otherwise pass a sanitized route key/template instead.
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
  intro,
}: LumiSurveyDockProps) => {
  // Resolve all config with defaults
  const config = useMemo(
    () => resolveConfig(labels, success, style, behavior, intro),
    [labels, success, style, behavior, intro],
  );

  // IMPORTANT: Call all hooks before any conditional returns to comply with Rules of Hooks

  // Intro state — starts true when intro is configured
  const [showIntro, setShowIntro] = useState(config.hasIntro);

  const handleIntroStart = useCallback(() => {
    setShowIntro(false);
  }, []);

  // Track previous showIntro value to detect intro → question transition
  const prevShowIntroRef = useRef(showIntro);

  /*
   * Use the new flexible survey builder.
   * "questions" is the full list of questions in display order.
   */
  const canonicalSurvey = useMemo(() => buildCanonicalSurvey(survey), [survey]);
  const { type: surveyType, questions } = canonicalSurvey;

  // The first question is used as the "prompt" question in the header
  const promptQuestion = questions[0];

  const promptHeadingId = `${surveyId}-${promptQuestion.id}-dock-heading`;
  const successHeadingId = `${surveyId}-dock-success-heading`;
  const introHeadingId = `${surveyId}-dock-intro-heading`;
  const panelId = `${surveyId}-dock-panel`;

  // Focus the question heading when transitioning from intro → questions
  useEffect(() => {
    if (prevShowIntroRef.current && !showIntro) {
      document.getElementById(promptHeadingId)?.focus();
    }
    prevShowIntroRef.current = showIntro;
  }, [showIntro, promptHeadingId]);

  // Auto-collect system context and merge with user-provided context
  const enrichedContext = useEnrichedContext(context, {
    collectLocation: config.collectLocation,
  });

  const { answers, status, error, setAnswer, submit, reset } = useLumiSurvey({
    surveyId,
    questions,
    transport,
    events,
    context: enrichedContext,
    surveyType,
  });

  const forceStepMode = config.questionLayout === "steps";
  const forceSinglePage = config.questionLayout === "singlePage";

  const {
    isStepMode: stepModeFromSurvey,
    currentQuestion: currentStepQuestion,
    canGoBack,
    canGoNext,
    isLastStep,
    goToNext,
    goToPrevious,
    resetNavigation,
    visitedSteps,
    hasBranching,
    visibleStepIndex,
    totalVisibleSteps,
  } = useStepNavigation({
    questions,
    answers,
    metadata: enrichedContext?.tags,
    forceStepMode,
    onStepChange: forceSinglePage ? undefined : events?.onStepChange,
  });

  // When the consumer explicitly requests "singlePage", always disable step
  // mode so that every question renders on one page — even for surveys that
  // contain branching logic.
  const isStepMode = forceSinglePage ? false : stepModeFromSurvey;

  const activeDescriptionQuestion =
    isStepMode && currentStepQuestion ? currentStepQuestion : promptQuestion;
  const promptDescriptionId = activeDescriptionQuestion.description
    ? `${surveyId}-${activeDescriptionQuestion.id}-dock-description`
    : undefined;

  // Combined reset: clears survey answers, resets step navigation, and restores intro screen
  const handleFullReset = useCallback(() => {
    reset();
    resetNavigation();
    setShowIntro(config.hasIntro);
  }, [reset, resetNavigation, config.hasIntro]);

  const { dismissed, shouldHideCompletely, isLoading, closeDock, reopenDock } =
    usePersistedDismissal({
      surveyId,
      initialOpen: config.initialOpen,
      dismissCooldownDays: config.dismissCooldownDays,
      events,
      resetOnClose: config.resetOnClose,
      onReset: handleFullReset,
      storageStrategy: config.storageStrategy,
    });

  // Filter questions based on visibleIf conditions (progressive disclosure)
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questions, answers, enrichedContext?.tags),
    [questions, answers, enrichedContext?.tags],
  );

  // Progressive submit: hide the button until there is at least one meaningful answer
  // and all required questions are currently valid.
  const isSubmitBlocked = useMemo(
    () => !shouldShowSubmitButton(questions, answers),
    [questions, answers],
  );

  // In step mode with branching, only validate questions the user actually visited
  // AND that are currently visible. This prevents validation failures on required
  // questions that became hidden after the user changed an earlier answer.
  const visitedQuestions = useMemo(() => {
    if (isStepMode) {
      const uniqueIndices = [...new Set(visitedSteps)];
      const visited = uniqueIndices
        .map((index) => questions[index])
        .filter(Boolean);
      return getVisibleQuestions(visited, answers, enrichedContext?.tags);
    }
    // Non-step mode: only validate visible questions (hidden questions are
    // excluded regardless of whether they were previously visible).
    return visibleQuestions;
  }, [
    isStepMode,
    visitedSteps,
    questions,
    visibleQuestions,
    answers,
    enrichedContext?.tags,
  ]);

  const showPersonalDataNotice = useMemo(() => {
    if (!config.showPersonalDataNotice) return false;

    if (isStepMode) {
      return currentStepQuestion?.type === "text";
    }

    return visibleQuestions.some((q) => q.type === "text");
  }, [
    config.showPersonalDataNotice,
    currentStepQuestion?.type,
    isStepMode,
    visibleQuestions,
  ]);

  const handleNext = useCallback(async () => {
    const result = goToNext();
    if (!result || result.nextIndex !== -1) {
      return;
    }

    try {
      await submit(visitedQuestions);
    } catch {
      // useLumiSurvey sets error state; avoid unhandled rejections
    }
  }, [goToNext, submit, visitedQuestions]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await submit(visitedQuestions);
    },
    [submit, visitedQuestions],
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
          successHeadingId={successHeadingId}
          introHeadingId={introHeadingId}
          onClose={handleCloseDock}
          onSubmit={handleSubmit}
          orderedQuestions={visibleQuestions}
          answers={answers}
          validationMissing={validationMissing}
          isSubmitting={isSubmitting}
          submitLabel={config.submitLabel}
          submitPendingLabel={config.submitPendingLabel}
          cancelLabel={config.cancelLabel}
          showPersonalDataNotice={showPersonalDataNotice}
          personalDataNotice={noticeContent}
          isSubmitBlocked={isSubmitBlocked}
          hasTransportError={Boolean(hasTransportError)}
          transportErrorMessage={config.transportErrorMessage}
          onQuestionChange={setAnswer}
          stepNavigation={{
            isStepMode,
            currentStep: visibleStepIndex,
            currentStepQuestion,
            canGoBack,
            canGoNext,
            isLastStep,
            onNext: handleNext,
            onBack: goToPrevious,
          }}
          progress={{
            showProgress: config.showProgress,
            totalSteps: totalVisibleSteps,
            hasBranching,
            hasIntro: !!config.introTitle,
          }}
          questionContext={{
            promptQuestionId: promptQuestion.id,
            promptHeadingId,
            promptDescriptionId,
            validationErrorMessage: config.validationErrorMessage,
          }}
          intro={{
            isIntro: showIntro,
            introTitle: config.introTitle,
            introBody: config.introBody,
            introStartLabel: config.introStartLabel,
            onIntroStart: handleIntroStart,
          }}
          success={{
            isSuccess,
            successTitle: config.successTitle,
            successBody: config.successBody,
            successPrimaryLabel: config.successPrimaryLabel,
          }}
        />
      )}
    </aside>
  );
};

LumiSurveyDock.displayName = "LumiSurveyDock";
