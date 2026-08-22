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
import { validateAnswers } from "../../core/validation.js";
import { getVisibilityMetadata } from "../../core/visibilityMetadata.js";

import { buildCanonicalSurvey } from "../shared/canonicalSurvey.js";
import type { LumiSurveyDefinition, SurveyDocumentV1 } from "../surveyTypes.js";
import { CLASS_NAMES, joinClassNames } from "./classNames.js";
import { DockPanel } from "./components/DockPanel.js";
import { MinimizedDock } from "./components/MinimizedDock.js";
import { useAutoCloseOnSuccess } from "./hooks/useAutoCloseOnSuccess.js";
import { useEnrichedContext } from "./hooks/useEnrichedContext.js";
import { usePageNavigation } from "./hooks/usePageNavigation.js";
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
 *   survey={survey}
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
   * Survey definition. Use a version 1 document with `pages` for new surveys.
   * Flat configurations remain supported for backwards compatibility.
   */
  survey: LumiSurveyDefinition;

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
   * System fields (viewport, screenResolution, deviceType, userAgent) are
   * auto-collected. `deviceType` uses browser client hints and user-agent
   * parsing first, with viewport width as a final fallback.
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

  // Intro/success authored in a V1 survey document act as defaults; explicit
  // embed props override them. Blank titles (lenient drafts) read as absent.
  const documentScreens = useMemo(() => {
    if (!survey || typeof survey !== "object" || !("pages" in survey)) {
      return { intro: undefined, success: undefined };
    }
    const document = survey as SurveyDocumentV1;
    const documentIntro =
      document.intro && document.intro.title.trim().length > 0
        ? {
            title: document.intro.title,
            body: document.intro.body,
            // Blank labels never reach the button; runtime falls back to
            // "Start" so it always has an accessible name.
            startLabel: document.intro.startLabel?.trim()
              ? document.intro.startLabel
              : undefined,
          }
        : undefined;
    const documentSuccess =
      document.success && document.success.title.trim().length > 0
        ? { title: document.success.title, body: document.success.body }
        : undefined;
    return { intro: documentIntro, success: documentSuccess };
  }, [survey]);
  // Field-level merge: the document authors the content, embed props adjust
  // individual fields — a partial `success={{ primaryLabel }}` must never
  // throw away the authored title/body.
  const { effectiveIntro, effectiveSuccess } = useMemo(() => {
    const mergedIntro =
      intro || documentScreens.intro
        ? ({
            ...documentScreens.intro,
            ...intro,
          } as LumiSurveyIntroConfig)
        : undefined;
    const mergedSuccess =
      success || documentScreens.success
        ? { ...documentScreens.success, ...success }
        : undefined;
    return { effectiveIntro: mergedIntro, effectiveSuccess: mergedSuccess };
  }, [intro, success, documentScreens]);
  const config = useMemo(
    () =>
      resolveConfig(labels, effectiveSuccess, style, behavior, effectiveIntro),
    [labels, effectiveSuccess, style, behavior, effectiveIntro],
  );

  // IMPORTANT: Call all hooks before any conditional returns to comply with Rules of Hooks

  const canonicalSurvey = useMemo(() => buildCanonicalSurvey(survey), [survey]);

  // Intro state — starts true when intro is configured. An explicit start
  // page (workshop stage, deep links) overrides the intro screen so edits
  // never demand a Start-click per remount. A typo'd page id falls back to
  // normal navigation and must NOT cost the intro.
  const requestedPageExists =
    config.initialPageId != null &&
    canonicalSurvey.pages.some((page) => page.id === config.initialPageId);
  const skipIntro = requestedPageExists;
  const [showIntro, setShowIntro] = useState(config.hasIntro && !skipIntro);

  // Track previous showIntro value to detect intro → question transition
  const prevShowIntroRef = useRef(showIntro);
  const pendingStepFocusRef = useRef(false);
  const dockRef = useRef<HTMLElement>(null);
  const minimizedButtonRef = useRef<HTMLButtonElement>(null);
  const focusWithinDockRef = useRef(false);
  const pendingDockFocusRef = useRef<"open-heading" | "minimized" | null>(null);
  const [stepValidationMissing, setStepValidationMissing] = useState<string[]>(
    [],
  );
  const [validationAttempt, setValidationAttempt] = useState(0);

  /*
   * Use the new flexible survey builder.
   * "questions" is the full list of questions in display order.
   */
  const { type: surveyType, questions, pages, source } = canonicalSurvey;

  // The first question is used as the "prompt" question in the header
  const promptQuestion = questions[0];

  const successHeadingId = `${surveyId}-dock-success-heading`;
  const introHeadingId = `${surveyId}-dock-intro-heading`;
  const panelId = `${surveyId}-dock-panel`;

  // Auto-collect system context and merge with user-provided context
  const enrichedContext = useEnrichedContext(context, {
    collectLocation: config.collectLocation,
    simulatedViewport: config.simulatedViewport,
  });
  const visibilityMetadata = useMemo(
    () => getVisibilityMetadata(enrichedContext),
    [enrichedContext],
  );

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

  const legacyNavigation = useStepNavigation({
    questions,
    answers,
    metadata: visibilityMetadata,
    forceStepMode,
    onStepChange:
      source === "legacy" && !forceSinglePage
        ? events?.onStepChange
        : undefined,
  });

  const pageNavigation = usePageNavigation({
    pages,
    answers,
    metadata: visibilityMetadata,
    forceStepMode,
    initialPageId: config.initialPageId,
    autoStepMode:
      source === "document-v1" &&
      config.questionLayout === "auto" &&
      pages.length > 1,
    onStepChange:
      source === "document-v1" && !forceSinglePage
        ? events?.onStepChange
        : undefined,
  });

  const navigation =
    source === "document-v1" ? pageNavigation : legacyNavigation;
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
  } = navigation;

  const currentPage =
    source === "document-v1"
      ? pageNavigation.currentPage
      : pages[navigation.currentStep];
  const currentPageQuestions =
    source === "document-v1"
      ? pageNavigation.currentPageQuestions
      : currentStepQuestion
        ? [currentStepQuestion]
        : [];

  // When the consumer explicitly requests "singlePage", always disable step
  // mode so that every question renders on one page — even for surveys that
  // contain branching logic.
  const isStepMode = forceSinglePage ? false : stepModeFromSurvey;

  const visiblePages = useMemo(
    () =>
      pages
        .map((page) => ({
          ...page,
          questions: getVisibleQuestions(
            page.questions,
            answers,
            visibilityMetadata,
          ),
        }))
        .filter((page) => page.questions.length > 0),
    [answers, pages, visibilityMetadata],
  );

  const headerPage =
    source === "document-v1"
      ? isStepMode
        ? currentPage
        : visiblePages[0]
      : undefined;
  const headerQuestion =
    source === "document-v1"
      ? ((isStepMode ? currentStepQuestion : visiblePages[0]?.questions[0]) ??
        promptQuestion)
      : isStepMode && currentStepQuestion
        ? currentStepQuestion
        : promptQuestion;
  const headerUsesPageTitle = Boolean(headerPage?.title);
  const promptHeadingId = headerUsesPageTitle
    ? `${surveyId}-${headerPage?.id}-page-heading`
    : `${surveyId}-${headerQuestion.id}-dock-heading`;
  const promptDescription = headerUsesPageTitle
    ? headerPage?.description
    : (headerPage?.description ?? headerQuestion.description);
  const promptDescriptionIsQuestionDescription = Boolean(
    !headerUsesPageTitle &&
      !headerPage?.description &&
      headerQuestion.description,
  );
  const promptDescriptionId = promptDescription
    ? `${promptHeadingId}-description`
    : undefined;
  const promptQuestionId = headerUsesPageTitle ? undefined : headerQuestion.id;

  // Focus the active page/question heading when leaving the intro.
  useEffect(() => {
    if (prevShowIntroRef.current && !showIntro) {
      document.getElementById(promptHeadingId)?.focus();
    }
    prevShowIntroRef.current = showIntro;
  }, [showIntro, promptHeadingId]);

  // Move focus only after an explicit step-navigation action has rendered its
  // target question. Answer-driven visibility updates must not steal focus.
  useEffect(() => {
    if (!pendingStepFocusRef.current) return;
    pendingStepFocusRef.current = false;
    document.getElementById(promptHeadingId)?.focus();
  }, [promptHeadingId]);

  // Filter questions based on visibleIf conditions (progressive disclosure)
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questions, answers, visibilityMetadata),
    [questions, answers, visibilityMetadata],
  );

  // Combined reset: clears survey answers, resets step navigation, and restores intro screen
  const handleFullReset = useCallback(() => {
    reset();
    resetNavigation();
    setStepValidationMissing([]);
    setValidationAttempt(0);
    setShowIntro(config.hasIntro && !skipIntro);
  }, [reset, resetNavigation, config.hasIntro, skipIntro]);

  const {
    dismissed,
    shouldHideCompletely,
    isLoading,
    markUserInteraction,
    closeDock,
    reopenDock,
  } = usePersistedDismissal({
    surveyId,
    initialOpen: config.initialOpen,
    dismissCooldownDays: config.dismissCooldownDays,
    events,
    resetOnClose: config.resetOnClose,
    onReset: handleFullReset,
    storageStrategy: config.storageStrategy,
    viewEnabled:
      source === "legacy" || visibleQuestions.length > 0 || showIntro,
  });

  const handleIntroStart = useCallback(() => {
    markUserInteraction();
    setShowIntro(false);
  }, [markUserInteraction]);

  const handleDockFocusCapture = useCallback(() => {
    focusWithinDockRef.current = true;
    markUserInteraction();
  }, [markUserInteraction]);

  const handleDockBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        !event.currentTarget.contains(nextTarget)
      ) {
        focusWithinDockRef.current = false;
      }
    },
    [],
  );

  // Progressive submit: hide the button until a currently visible question has
  // at least one meaningful answer. Required-answer validation happens on submit.
  const isSubmitBlocked = useMemo(
    () => !shouldShowSubmitButton(questions, answers, visibilityMetadata),
    [questions, answers, visibilityMetadata],
  );

  // In step mode with branching, only validate questions the user actually visited
  // AND that are currently visible. This prevents validation failures on required
  // questions that became hidden after the user changed an earlier answer.
  const visitedQuestions = useMemo(() => {
    if (isStepMode) {
      const uniqueIndices = [...new Set(visitedSteps)];
      const visited =
        source === "document-v1"
          ? uniqueIndices.flatMap((index) => pages[index]?.questions ?? [])
          : uniqueIndices.map((index) => questions[index]).filter(Boolean);
      return getVisibleQuestions(visited, answers, visibilityMetadata);
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
    visibilityMetadata,
    source,
    pages,
  ]);

  const showPersonalDataNotice = useMemo(() => {
    if (!config.showPersonalDataNotice) return false;

    if (isStepMode) {
      return currentPageQuestions.some((question) => question.type === "text");
    }

    return visibleQuestions.some((q) => q.type === "text");
  }, [
    config.showPersonalDataNotice,
    currentPageQuestions,
    isStepMode,
    visibleQuestions,
  ]);

  const handleNext = useCallback(async () => {
    markUserInteraction();

    if (source === "document-v1") {
      const missing = validateAnswers(currentPageQuestions, answers);
      if (missing.length > 0) {
        setStepValidationMissing(missing);
        setValidationAttempt((attempt) => attempt + 1);
        events?.onValidationFailed?.(missing);
        return;
      }
      setStepValidationMissing([]);
    }

    const result = goToNext();
    if (result?.nextIndex !== undefined && result.nextIndex !== -1) {
      pendingStepFocusRef.current = true;
      return;
    }

    if (!result) {
      return;
    }

    try {
      await submit(visitedQuestions);
    } catch {
      // useLumiSurvey sets error state; avoid unhandled rejections
    }
  }, [
    answers,
    currentPageQuestions,
    events,
    goToNext,
    markUserInteraction,
    source,
    submit,
    visitedQuestions,
  ]);

  const handleBack = useCallback(() => {
    markUserInteraction();
    const previousIndex = goToPrevious();
    if (previousIndex === null) return;
    setStepValidationMissing([]);
    pendingStepFocusRef.current = true;
  }, [goToPrevious, markUserInteraction]);

  const handleQuestionChange = useCallback(
    (questionId: string, value: Parameters<typeof setAnswer>[1]) => {
      markUserInteraction();
      setAnswer(questionId, value);
      setStepValidationMissing((missing) =>
        missing.includes(questionId)
          ? missing.filter((id) => id !== questionId)
          : missing,
      );
    },
    [markUserInteraction, setAnswer],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      markUserInteraction();
      const missing = validateAnswers(visitedQuestions, answers);
      if (missing.length > 0) {
        setStepValidationMissing(missing);
        setValidationAttempt((attempt) => attempt + 1);
        events?.onValidationFailed?.(missing);
        return;
      }
      setStepValidationMissing([]);
      await submit(visitedQuestions);
    },
    [answers, events, markUserInteraction, submit, visitedQuestions],
  );

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const enteredSuccess =
      previousStatusRef.current !== "success" && status === "success";
    previousStatusRef.current = status;

    if (enteredSuccess && focusWithinDockRef.current) {
      document.getElementById(successHeadingId)?.focus();
    }
  }, [status, successHeadingId]);

  const handleCloseDock = useCallback(() => {
    const hideCompletely = isSuccess && config.hideAfterSubmit;
    const focusIsWithinDock = dockRef.current?.contains(document.activeElement);
    pendingDockFocusRef.current =
      focusIsWithinDock && !hideCompletely ? "minimized" : null;
    closeDock(hideCompletely);
  }, [closeDock, isSuccess, config.hideAfterSubmit]);

  const handleReopenDock = useCallback(() => {
    pendingDockFocusRef.current = "open-heading";
    reopenDock();
  }, [reopenDock]);

  useEffect(() => {
    if (pendingDockFocusRef.current === "minimized" && dismissed) {
      minimizedButtonRef.current?.focus();
      pendingDockFocusRef.current = null;
      return;
    }

    if (pendingDockFocusRef.current === "open-heading" && !dismissed) {
      const headingId = isSuccess
        ? successHeadingId
        : showIntro
          ? introHeadingId
          : promptHeadingId;
      document.getElementById(headingId)?.focus();
      pendingDockFocusRef.current = null;
    }
  }, [
    dismissed,
    introHeadingId,
    isSuccess,
    promptHeadingId,
    showIntro,
    successHeadingId,
  ]);

  useAutoCloseOnSuccess({
    enabled: config.autoCloseOnSuccess,
    status,
    delayMs: config.successCloseDelayMs,
    onClose: handleCloseDock,
  });
  const validationMissing = useMemo(() => {
    const storedMissing = new Set([
      ...stepValidationMissing,
      ...(error?.type === "validation" ? error.missing : []),
    ]);
    if (storedMissing.size === 0) return [];

    const renderedQuestions = isStepMode
      ? currentPageQuestions
      : visibleQuestions;
    const stillMissing = new Set(validateAnswers(renderedQuestions, answers));
    return [...storedMissing].filter((id) => stillMissing.has(id));
  }, [
    answers,
    currentPageQuestions,
    error,
    isStepMode,
    stepValidationMissing,
    visibleQuestions,
  ]);
  const hasTransportError = error?.type === "transport";

  const baseContainerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: config.offset,
    right: config.position === "bottom-right" ? config.offset : undefined,
    left: config.position === "bottom-left" ? config.offset : undefined,
    zIndex: 1000,
  };

  const isNpsDock =
    headerQuestion.type === "rating" &&
    (headerQuestion as RatingQuestion).variant === "nps";

  const openWidthRem = isNpsDock ? 32 : 24;

  const openWidth = config.simulatedViewport
    ? `${Math.min(
        openWidthRem * 16,
        config.simulatedViewport.width - config.offset * 2,
      )}px`
    : `min(${openWidthRem}rem, calc(100vw - ${config.offset * 2}px))`;
  const containerStyle: React.CSSProperties = dismissed
    ? baseContainerStyle
    : {
        ...baseContainerStyle,
        width: openWidth,
      };

  const panelStyle: React.CSSProperties = {
    maxHeight: config.panelMaxHeight,
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

  if (
    source === "document-v1" &&
    visibleQuestions.length === 0 &&
    !showIntro &&
    !isSuccess
  ) {
    return null;
  }

  return (
    <aside
      ref={dockRef}
      className={joinClassNames(
        CLASS_NAMES.container,
        config.containerClassName,
      )}
      style={containerStyle}
      data-feedback-id={surveyId}
      data-state={dismissed ? "dismissed" : "open"}
      aria-label="Tilbakemeldingspanel"
      onFocusCapture={handleDockFocusCapture}
      onBlurCapture={handleDockBlurCapture}
      onPointerDownCapture={markUserInteraction}
    >
      {dismissed ? (
        <MinimizedDock
          label={config.minimizedButtonLabel}
          onReopen={handleReopenDock}
          className={CLASS_NAMES.minimizedButton}
          buttonRef={minimizedButtonRef}
        />
      ) : (
        <DockPanel
          panelId={panelId}
          panelLabel="Gi tilbakemelding"
          panelClassName={config.panelClassName}
          panelStyle={panelStyle}
          panelBackground={config.panelBackground}
          panelBorderColor={config.panelBorderColor}
          promptQuestion={headerQuestion}
          headerTitle={headerPage?.title}
          headerDescription={promptDescription}
          successHeadingId={successHeadingId}
          introHeadingId={introHeadingId}
          onClose={handleCloseDock}
          onSubmit={handleSubmit}
          orderedQuestions={visibleQuestions}
          orderedPages={source === "document-v1" ? visiblePages : undefined}
          answers={answers}
          validationMissing={validationMissing}
          validationAttempt={validationAttempt}
          isSubmitting={isSubmitting}
          submitLabel={config.submitLabel}
          submitPendingLabel={config.submitPendingLabel}
          cancelLabel={config.cancelLabel}
          showPersonalDataNotice={showPersonalDataNotice}
          personalDataNotice={noticeContent}
          isSubmitBlocked={isSubmitBlocked}
          hasTransportError={Boolean(hasTransportError)}
          transportErrorMessage={config.transportErrorMessage}
          onQuestionChange={handleQuestionChange}
          stepNavigation={{
            isStepMode,
            currentStep: visibleStepIndex,
            currentStepQuestion,
            currentStepQuestions: currentPageQuestions,
            canGoBack,
            canGoNext,
            isLastStep,
            disableWhenIncomplete: source === "legacy",
            onNext: handleNext,
            onBack: handleBack,
          }}
          progress={{
            showProgress: config.showProgress,
            totalSteps: totalVisibleSteps,
            hasBranching,
          }}
          questionContext={{
            promptQuestionId,
            promptHeadingId,
            promptDescriptionId,
            promptDescriptionIsQuestionDescription,
            questionAnchorPrefix: `${surveyId}-question`,
            validationErrorMessage: config.validationErrorMessage,
            validationSummaryHeading: config.validationSummaryHeading,
            textTooLongErrorMessage: config.textTooLongErrorMessage,
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
