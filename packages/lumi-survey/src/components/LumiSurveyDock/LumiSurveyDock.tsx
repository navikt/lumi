"use client";

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import type {
  LumiSurveyContext,
  LumiSurveyEndpoint,
  LumiSurveyEvents,
  LumiSurveyTransport,
  RatingQuestion,
} from "../../core";

import { SurveyLanguageProvider } from "../shared/surveyLanguage.js";
import { hasFocusInside, treeOf } from "../shared/surveyTree.js";
import type { LumiSurveyDefinition } from "../surveyTypes.js";
import { CLASS_NAMES, joinClassNames } from "./classNames.js";
import { DockPanel } from "./components/DockPanel.js";
import { MinimizedDock } from "./components/MinimizedDock.js";
import { returnFocusToPage } from "./focusReturn.js";
import { useAutoCloseOnSuccess } from "./hooks/useAutoCloseOnSuccess.js";
import {
  type UsePersistedDismissalReturn,
  usePersistedDismissal,
} from "./hooks/usePersistedDismissal.js";
import { useSurveyConfig } from "./hooks/useSurveyConfig.js";
import { useSubmitFocus, useSurveyFlow } from "./hooks/useSurveyFlow.js";
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
   * Sends the answers to the app's backend:
   * - `{ endpoint: "/api/lumi/feedback" }`: the widget sends them itself. This
   *   is the only form a React Server Component can pass.
   * - A `LumiSurveyTransport` with `submit`: send them your own way. A `submit`
   *   function always wins over `endpoint`.
   *
   * Without a usable transport the dock renders nothing and logs an error.
   */
  transport: LumiSurveyTransport | LumiSurveyEndpoint;

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
   * Structured context for segmentation (`tags`) and optional diagnostic data (`debug`).
   * Debug data is stored with submissions, but is not exposed by the current
   * dashboard/export read model.
   * System fields (viewport, screenResolution, deviceType, userAgent) are
   * auto-collected. `deviceType` uses browser client hints and user-agent
   * parsing first, with viewport width as a final fallback.
   *
   * Note: `url` is never auto-collected. `pathname` can be auto-collected if
   * `behavior.collectLocation` is enabled. Only use this if your routes do not
   * contain identifiers; otherwise pass a sanitized route key/template instead.
   */
  context?: LumiSurveyContext;

  /**
   * Language of the text that comes from the survey: titles, questions,
   * options and the intro and receipt text. Without `lang` the widget
   * inherits the page language. Set for example `"nb"` when the survey is in
   * Bokmål on an English page. Built-in copy such as "Neste" and "Tilbake" is
   * marked as Bokmål unless it is replaced through `labels`.
   */
  lang?: string;
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
  lang,
}: LumiSurveyDockProps) => {
  // Resolve all config with defaults
  const config = useSurveyConfig({
    survey,
    labels,
    success,
    style,
    behavior,
    intro,
  });

  useEffect(() => {
    if (!config.initialOpen && config.hideMinimizedButton) {
      console.warn(
        "[Lumi] initialOpen: false and hideMinimizedButton: true together mean the survey never shows.",
      );
    }
  }, [config.initialOpen, config.hideMinimizedButton]);

  // IMPORTANT: Call all hooks before any conditional returns to comply with Rules of Hooks

  const minimizedButtonRef = useRef<HTMLButtonElement>(null);
  // The host page element that had focus before focus entered the dock.
  const focusReturnTargetRef = useRef<HTMLElement | null>(null);
  const pendingDockFocusRef = useRef<
    "open-heading" | "minimized" | "return" | null
  >(null);

  // The survey flow reports every interaction to the dismissal hook, and the
  // dismissal hook resets the flow when the dock closes. The flow is created
  // first, so it reaches `markUserInteraction` through this ref.
  const dismissalRef = useRef<UsePersistedDismissalReturn | null>(null);
  const handleInteraction = useCallback(() => {
    dismissalRef.current?.markUserInteraction();
  }, []);

  const flow = useSurveyFlow({
    surveyId,
    // The dock's DOM ids have always been built from `surveyId`.
    domIdPrefix: surveyId,
    survey,
    transport,
    events,
    context,
    config,
    onInteraction: handleInteraction,
  });
  const {
    rootRef: dockRef,
    userInSurvey,
    status,
    isSuccess,
    showIntro,
    headerQuestion,
    introHeadingId,
    promptHeadingId,
    successHeadingId,
  } = flow;

  const dismissal = usePersistedDismissal({
    surveyId,
    initialOpen: config.initialOpen,
    dismissCooldownDays: config.dismissCooldownDays,
    events,
    resetOnClose: config.resetOnClose,
    onReset: flow.reset,
    storageStrategy: config.storageStrategy,
    viewEnabled: flow.isViewable,
  });
  dismissalRef.current = dismissal;
  const {
    dismissed,
    shouldHideCompletely,
    isLoading,
    markUserInteraction,
    closeDock,
    reopenDock,
    persistSubmission,
  } = dismissal;

  useSubmitFocus(flow, {
    onSubmitted: () => {
      // Remember the answered survey right away. Users often leave the
      // receipt without pressing close, and the survey must not reopen on the
      // next page.
      persistSubmission(config.hideAfterSubmit);
    },
    refocusSubmitOnError: true,
  });

  const handleDockFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const previousTarget = event.relatedTarget;
      if (
        previousTarget instanceof HTMLElement &&
        !event.currentTarget.contains(previousTarget)
      ) {
        focusReturnTargetRef.current = previousTarget;
      }
      userInSurvey.handlers.onFocusCapture(event);
    },
    [userInSurvey],
  );

  const handleCloseDock = useCallback(() => {
    // The automatic close can fire after the user has closed the receipt. A
    // focus move noted now would wait and pull focus from the page later.
    if (dismissed) {
      return;
    }
    const hideCompletely = isSuccess && config.hideAfterSubmit;
    const focusIsWithinDock = hasFocusInside(dockRef.current);
    // Without a minimized button to land on, focus goes back to the page.
    pendingDockFocusRef.current = focusIsWithinDock
      ? hideCompletely || config.hideMinimizedButton
        ? "return"
        : "minimized"
      : null;
    closeDock(hideCompletely);
  }, [
    closeDock,
    dismissed,
    dockRef,
    isSuccess,
    config.hideAfterSubmit,
    config.hideMinimizedButton,
  ]);

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

    // The dock has unmounted, so focus would otherwise fall back to <body>.
    if (pendingDockFocusRef.current === "return" && dismissed) {
      pendingDockFocusRef.current = null;
      userInSurvey.leave();
      returnFocusToPage(focusReturnTargetRef.current);
      focusReturnTargetRef.current = null;
      return;
    }

    if (pendingDockFocusRef.current === "open-heading" && !dismissed) {
      const headingId = isSuccess
        ? successHeadingId
        : showIntro
          ? introHeadingId
          : promptHeadingId;
      treeOf(dockRef.current).getElementById(headingId)?.focus();
      pendingDockFocusRef.current = null;
    }
  }, [
    dismissed,
    dockRef,
    introHeadingId,
    isSuccess,
    promptHeadingId,
    showIntro,
    successHeadingId,
    userInSurvey,
  ]);

  useAutoCloseOnSuccess({
    enabled: config.autoCloseOnSuccess,
    status,
    delayMs: config.successCloseDelayMs,
    onClose: handleCloseDock,
  });

  const baseContainerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: config.offset,
    right: config.position === "bottom-right" ? config.offset : undefined,
    left: config.position === "bottom-left" ? config.offset : undefined,
    zIndex: config.zIndex,
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

  // Don't render anything while loading persisted state
  if (isLoading) {
    return null;
  }

  // A survey that cannot be sent must not ask users to fill it in.
  if (!flow.hasTransport) {
    return null;
  }

  // Don't render anything when dismissed with hideCompletely flag, or when
  // the app has asked not to show the minimized button.
  if (dismissed && (shouldHideCompletely || config.hideMinimizedButton)) {
    return null;
  }

  if (flow.isEmpty) {
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
      // No lang here: replaced labels inherit the page language. Built-in copy
      // marks itself as Bokmål, and survey text gets the `lang` prop through
      // SurveyLanguageProvider.
      aria-label="Tilbakemeldingspanel"
      onFocusCapture={handleDockFocusCapture}
      onBlurCapture={userInSurvey.handlers.onBlurCapture}
      onPointerDownCapture={markUserInteraction}
      onClickCapture={userInSurvey.handlers.onClickCapture}
    >
      <SurveyLanguageProvider value={lang}>
        {dismissed ? (
          <MinimizedDock
            label={config.minimizedButtonLabel}
            onReopen={handleReopenDock}
            className={CLASS_NAMES.minimizedButton}
            buttonRef={minimizedButtonRef}
          />
        ) : (
          <DockPanel
            {...flow.panelProps}
            panelStyle={panelStyle}
            onClose={handleCloseDock}
          />
        )}
      </SurveyLanguageProvider>
    </aside>
  );
};

LumiSurveyDock.displayName = "LumiSurveyDock";
