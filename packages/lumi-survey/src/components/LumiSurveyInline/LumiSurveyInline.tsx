"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  LumiSurveyContext,
  LumiSurveyEndpoint,
  LumiSurveyEvents,
  LumiSurveyTransport,
} from "../../core";
import { CLASS_NAMES, joinClassNames } from "../LumiSurveyDock/classNames.js";
import { DockPanel } from "../LumiSurveyDock/components/DockPanel.js";
import { useSurveyConfig } from "../LumiSurveyDock/hooks/useSurveyConfig.js";
import {
  useSubmitFocus,
  useSurveyFlow,
} from "../LumiSurveyDock/hooks/useSurveyFlow.js";
import type {
  LumiSurveyIntroConfig,
  LumiSurveyLabels,
  LumiSurveySuccessConfig,
} from "../LumiSurveyDock/propTypes.js";
import { SurveyFieldIdProvider } from "../shared/surveyFieldId.js";
import {
  resolveSurveyHeadingLevel,
  type SurveyHeadingLevel,
  SurveyHeadingLevelProvider,
} from "../shared/surveyHeadingLevel.js";
import { SurveyLanguageProvider } from "../shared/surveyLanguage.js";
import type { SurveyDocumentV1 } from "../surveyTypes.js";
import {
  useSightWhileSending,
  useViewportPresence,
} from "./hooks/useViewportPresence.js";
import "./LumiSurveyInline.fallback.css";

import type {
  LumiSurveyInlineBehavior,
  LumiSurveyInlineStyle,
} from "./propTypes.js";

/**
 * Props for the LumiSurveyInline component.
 *
 * @example
 * ```tsx
 * <ResultList results={results} />
 * <LumiSurveyInline
 *   surveyId="search-results-feedback"
 *   survey={survey}
 *   transport={{ endpoint: "/api/lumi/feedback" }}
 *   headingLevel="3"
 *   context={{ tags: { surface: "inline", placement: "under-result-list" } }}
 * />
 * ```
 */
export interface LumiSurveyInlineProps {
  /**
   * Identifies the survey in Lumi. The same `surveyId` can be shown in several
   * places, also on one page. Tell the places apart with `context.tags`. A
   * new `surveyId` starts the survey over, without the answers given so far.
   * @example "sokeresultat-tilbakemelding"
   */
  surveyId: string;

  /**
   * Survey document from Surveyverksted or code. An inline survey takes a
   * version 1 document with `pages`, not the older flat configuration.
   */
  survey: SurveyDocumentV1;

  /**
   * Sends the answers to the app's backend:
   * - `{ endpoint: "/api/lumi/feedback" }`: the widget sends them itself. This
   *   is the only form a React Server Component can pass.
   * - A `LumiSurveyTransport` with `submit`: send them your own way. A `submit`
   *   function always wins over `endpoint`.
   *
   * Without a usable transport the survey renders nothing and logs an error.
   */
  transport: LumiSurveyTransport | LumiSurveyEndpoint;

  /**
   * Labels for UI elements (submit button, error messages, etc.). An inline
   * survey has neither a close button nor a minimized button.
   */
  labels?: Omit<LumiSurveyLabels, "cancel" | "minimizedButton">;

  /**
   * Title and body of the receipt. The receipt stays where the survey was, so
   * it has no button and does not close.
   */
  success?: Pick<LumiSurveySuccessConfig, "title" | "body">;

  /**
   * Visual styling options (colors, classNames). The width follows the
   * container the survey is placed in. As an item in a flex row the survey
   * takes the width its content needs.
   */
  style?: LumiSurveyInlineStyle;

  /**
   * Behavior options (question layout, progress, privacy notice).
   */
  behavior?: LumiSurveyInlineBehavior;

  /**
   * Optional event callbacks for tracking user interactions and lifecycle
   * events. `onViewDock` is called once, the first time the survey is on
   * screen or the user does something in it. `onReset` and
   * `onDismissalPersistFailed` are never called: an inline survey is not
   * closed and stores nothing.
   */
  events?: LumiSurveyEvents;

  /**
   * Optional intro screen configuration.
   * When set, an introduction screen is shown before the first question.
   */
  intro?: LumiSurveyIntroConfig;

  /**
   * Structured context for segmentation (`tags`) and optional diagnostic data
   * (`debug`). Use tags such as `surface: "inline"` and `placement` to tell
   * where on the page an answer came from. System fields (viewport,
   * screenResolution, deviceType, userAgent) are auto-collected.
   *
   * Note: `url` is never auto-collected. `pathname` can be auto-collected if
   * `behavior.collectLocation` is enabled. Only use this if your routes do not
   * contain identifiers; otherwise pass a sanitized route key/template instead.
   */
  context?: LumiSurveyContext;

  /**
   * Language of the text that comes from the survey: titles, questions,
   * options and the intro and receipt text. Without `lang` the survey
   * inherits the page language. Built-in copy such as "Neste" and "Tilbake"
   * is marked as Bokmål unless it is replaced through `labels`.
   */
  lang?: string;

  /**
   * Heading level of the survey's title. Set it to the level below the
   * heading of the content the survey belongs to, so the survey fits the
   * heading structure of the page. Questions with their own heading use the
   * level below this one.
   * @default "2"
   */
  headingLevel?: SurveyHeadingLevel;
}

const subscribeToNothing = () => () => {};
const inBrowser = () => true;
const onServer = () => false;

/**
 * False on the server and while hydrating, true in the browser from then on.
 * Which questions show can depend on the viewport and the device, which the
 * server does not know. The survey is therefore only rendered in the browser.
 */
const useIsBrowser = (): boolean =>
  useSyncExternalStore(subscribeToNothing, inBrowser, onServer);

const randomPart = (): string => Math.random().toString(36).slice(2, 8);

/**
 * DOM ids must be unique in the whole document. The same `surveyId` can be
 * shown twice on a page, and React's `useId` starts over in every copy of
 * React, so two apps that each bundle React, such as microfrontends, would
 * make the same ids.
 */
const createDomIdPrefix = (): string =>
  `lumi-inline-${randomPart()}${randomPart()}`;

const InlineSurvey = ({
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
  headingLevel,
}: LumiSurveyInlineProps) => {
  const config = useSurveyConfig({
    survey,
    labels,
    success,
    style,
    behavior,
    intro,
  });

  const [domIdPrefix] = useState(createDomIdPrefix);

  // The flow reports what the user does, and what happens then depends on
  // values the flow returns. The flow is created first, so it reaches the
  // handler through this ref.
  const interactionRef = useRef<() => void>(() => {});
  const reportInteraction = useCallback(() => {
    interactionRef.current();
  }, []);

  const flow = useSurveyFlow({
    surveyId,
    domIdPrefix,
    positionalDomIds: true,
    survey,
    transport,
    events,
    context,
    config,
    onInteraction: reportInteraction,
  });
  const { rootRef, restartTimer, questionDomKey } = flow;

  // Every id names its part before the question: `…-field-q0`,
  // `…-option-1-q0`. No id is then built by adding to another, and none of
  // them holds text from the document.
  const fieldId = useCallback(
    (questionId: string, part: string) =>
      `${domIdPrefix}-${part}-${questionDomKey(questionId)}`,
    [domIdPrefix, questionDomKey],
  );

  const isBrowser = useIsBrowser();
  // A survey that cannot be sent, or has nothing to show, renders nothing.
  const isShown = isBrowser && flow.hasTransport && !flow.isEmpty;

  // What is measured is the panel the user sees. The element around it can be
  // stretched by a flex row or a grid, and that empty space is no survey.
  const panelRef = useRef<HTMLDivElement>(null);
  const { seen, markSeen } = useViewportPresence(panelRef, isShown);

  // `startedAt` counts from when the user first sees or uses the survey,
  // not from when the page rendered it somewhere below the fold.
  const timerStartedRef = useRef(false);
  const startTimer = useCallback(() => {
    if (timerStartedRef.current) {
      return;
    }
    timerStartedRef.current = true;
    restartTimer();
  }, [restartTimer]);

  // Consumer examples use inline event objects. Their identity must not
  // define a new view.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  // React runs an effect again when a hidden part of the app is shown again,
  // as with `<Activity>`. The survey is still the same one, so the view is
  // reported once for as long as it is mounted.
  const viewReportedRef = useRef(false);
  const reportView = useCallback(() => {
    if (viewReportedRef.current) {
      return;
    }
    viewReportedRef.current = true;
    startTimer();
    eventsRef.current?.onViewDock?.(surveyId);
  }, [startTimer, surveyId]);
  useEffect(() => {
    if (seen) {
      reportView();
    }
  }, [seen, reportView]);

  // A user who answers, clicks in the survey or moves focus into it has
  // seen it, also when too little of it is on screen to count. A pointer that
  // only lands on the survey is not enough: on a touch screen that is how the
  // user scrolls past it. The view is reported at once, before the answer:
  // the app can start a new survey from `onAnswer`, and this one is gone
  // before an effect would run.
  const handleInteraction = useCallback(() => {
    markSeen();
    reportView();
  }, [markSeen, reportView]);
  interactionRef.current = handleInteraction;

  // When a submit ends, focus moves to the receipt, or back to the submit
  // button if sending failed. The page does not scroll back to a survey the
  // user has scrolled away from while the answer was sent.
  const isOnScreen = useSightWhileSending(
    panelRef,
    flow.status === "submitting",
  );
  useSubmitFocus(flow, { isOnScreen, refocusSubmitOnError: true });

  if (!isShown) {
    return null;
  }

  return (
    <section
      ref={rootRef}
      className={joinClassNames(
        CLASS_NAMES.inlineContainer,
        config.containerClassName,
      )}
      data-feedback-id={surveyId}
      // No lang here: replaced labels inherit the page language. Built-in copy
      // marks itself as Bokmål, and survey text gets the `lang` prop through
      // SurveyLanguageProvider.
      {...flow.userInSurvey.handlers}
    >
      <SurveyLanguageProvider value={lang}>
        <SurveyHeadingLevelProvider
          value={resolveSurveyHeadingLevel(headingLevel)}
        >
          <SurveyFieldIdProvider value={fieldId}>
            <DockPanel
              {...flow.panelProps}
              panelRef={panelRef}
              elevated={false}
              formless
            />
          </SurveyFieldIdProvider>
        </SurveyHeadingLevelProvider>
      </SurveyLanguageProvider>
    </section>
  );
};

/**
 * A survey that is part of the page: it is rendered where the app places it,
 * for example right below the content it asks about. It uses the same survey
 * document, validation and submission as `LumiSurveyDock`, but it has no
 * close button, is never minimized and stores nothing in the browser.
 */
export const LumiSurveyInline = (props: LumiSurveyInlineProps) => (
  // A new `surveyId` is a new survey. It starts without the answers and the
  // receipt of the one before it, counts its own view and times its own
  // answer.
  <InlineSurvey key={props.surveyId} {...props} />
);

LumiSurveyInline.displayName = "LumiSurveyInline";
