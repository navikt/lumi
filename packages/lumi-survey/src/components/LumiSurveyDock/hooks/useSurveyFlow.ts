import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LumiSurveyContext,
  LumiSurveyEndpoint,
  LumiSurveyEvents,
  LumiSurveyQuestion,
  LumiSurveyStatus,
  LumiSurveyTransport,
} from "../../../core";
import { getVisibleQuestions, shouldShowSubmitButton } from "../../../core";
import { resolveDocumentVisibility } from "../../../core/documentVisibility.js";
import {
  createEndpointTransport,
  describeMissingTransport,
  describeTransportShape,
  isCustomTransport,
  isEndpointTransport,
  resolveEndpoint,
} from "../../../core/endpointTransport.js";
import { useLumiSurveyState } from "../../../core/useLumiSurvey.js";
import { validateAnswers } from "../../../core/validation.js";
import { getVisibilityMetadata } from "../../../core/visibilityMetadata.js";
import { buildCanonicalSurvey } from "../../shared/canonicalSurvey.js";
import {
  focusIsNowhere,
  focusPath,
  hasFocusInside,
  treeOf,
} from "../../shared/surveyTree.js";
import {
  type UserInSurvey,
  useUserInSurvey,
} from "../../shared/useUserInSurvey.js";
import type { LumiSurveyDefinition } from "../../surveyTypes.js";
import type { DockPanelProps } from "../components/DockPanel.js";
import { SUBMIT_BUTTON_ATTRIBUTE } from "../components/SurveyFormContent.js";
import type { ResolvedConfig } from "../resolveConfig.js";
import { useEnrichedContext } from "./useEnrichedContext.js";
import { usePageNavigation } from "./usePageNavigation.js";
import { useStepNavigation } from "./useStepNavigation.js";

// Never called: the survey renders nothing without a usable transport.
const MISSING_TRANSPORT: LumiSurveyTransport = {
  submit: () => Promise.reject(new Error("Lumi: No usable transport")),
};

export interface UseSurveyFlowOptions {
  surveyId: string;
  /**
   * Prefix for the DOM ids the survey creates. The dock uses `surveyId`, as
   * it always has. An inline survey passes an id of its own, so the same
   * survey can be shown more than once on a page.
   */
  domIdPrefix: string;
  /**
   * Build the DOM ids from where a page or a question stands in the
   * document, and not from its id. Ids from a document can be the start or
   * the end of each other, and can hold a space, so two elements could get
   * the same DOM id and an ARIA reference could be split in two. The dock
   * builds its DOM ids from the ids, as it always has.
   */
  positionalDomIds?: boolean;
  survey: LumiSurveyDefinition;
  transport: LumiSurveyTransport | LumiSurveyEndpoint;
  events?: LumiSurveyEvents;
  context?: LumiSurveyContext;
  config: ResolvedConfig;
  /** Called each time the user does something in the survey. */
  onInteraction?: () => void;
}

/** What the panel needs from the flow. The component adds its own frame. */
export type SurveyFlowPanelProps = Omit<
  DockPanelProps,
  "panelStyle" | "elevated" | "formless" | "onClose"
>;

export interface SurveyFlow {
  /** Goes on the element that wraps the survey. */
  rootRef: React.RefObject<HTMLElement | null>;
  /**
   * Whether the user is in the survey. Its handlers go on the element that
   * wraps the survey.
   */
  userInSurvey: UserInSurvey;
  /** False when `transport` cannot send anything. Render nothing then. */
  hasTransport: boolean;
  /** True when the survey can be sent and has something to show. */
  isViewable: boolean;
  /** True when a document has nothing to show: no visible question or receipt. */
  isEmpty: boolean;
  status: LumiSurveyStatus;
  isSuccess: boolean;
  showIntro: boolean;
  /** The question that heads the panel when the page has no title. */
  headerQuestion: LumiSurveyQuestion;
  /**
   * The name a question has in DOM ids: its id, or its position in the
   * document with `positionalDomIds`.
   */
  questionDomKey: (questionId: string) => string;
  /** Ids of the three headings the panel can show. */
  introHeadingId: string;
  promptHeadingId: string;
  successHeadingId: string;
  /** Clears the answers and returns to the first page, or to the intro. */
  reset: () => void;
  /** Moves `startedAt` to now. */
  restartTimer: () => void;
  panelProps: SurveyFlowPanelProps;
}

/**
 * Everything a survey does between the first question and the receipt:
 * pages and steps, visibility, validation, submitting, and keeping focus in
 * the survey as it moves on. `LumiSurveyDock` and `LumiSurveyInline` share
 * it and add their own placement around the panel.
 */
export function useSurveyFlow({
  surveyId,
  domIdPrefix,
  positionalDomIds = false,
  survey,
  transport,
  events,
  context,
  config,
  onInteraction,
}: UseSurveyFlowOptions): SurveyFlow {
  const onInteractionRef = useRef(onInteraction);
  onInteractionRef.current = onInteraction;
  const markUserInteraction = useCallback(() => {
    onInteractionRef.current?.();
  }, []);

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
  const rootRef = useRef<HTMLElement>(null);
  const userInSurvey = useUserInSurvey(rootRef, markUserInteraction);
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

  const domKeys = useMemo(() => {
    if (!positionalDomIds) {
      const unchanged = (id: string) => id;
      return { page: unchanged, question: unchanged };
    }
    const pageKeys = new Map(
      pages.map((page, index) => [page.id, `p${index}`]),
    );
    const questionKeys = new Map(
      questions.map((question, index) => [question.id, `q${index}`]),
    );
    return {
      page: (id: string) => pageKeys.get(id) ?? id,
      question: (id: string) => questionKeys.get(id) ?? id,
    };
  }, [pages, positionalDomIds, questions]);
  const questionAnchorId = useCallback(
    (questionId: string) =>
      `${domIdPrefix}-question-${domKeys.question(questionId)}`,
    [domIdPrefix, domKeys],
  );

  const successHeadingId = `${domIdPrefix}-dock-success-heading`;
  const introHeadingId = `${domIdPrefix}-dock-intro-heading`;
  const panelId = `${domIdPrefix}-dock-panel`;

  // Auto-collect system context and merge with user-provided context
  const enrichedContext = useEnrichedContext(context, {
    collectLocation: config.collectLocation,
    simulatedViewport: config.simulatedViewport,
  });
  const visibilityMetadata = useMemo(
    () => getVisibilityMetadata(enrichedContext),
    [enrichedContext],
  );

  // `{ endpoint }` is often written inline, so key the built-in transport on
  // the string and not on the object.
  const endpoint = isEndpointTransport(transport)
    ? transport.endpoint
    : undefined;
  const customTransport = isCustomTransport(transport) ? transport : undefined;
  const shapeProblem = describeTransportShape(transport);
  const endpointResolution = useMemo(
    () =>
      customTransport
        ? undefined
        : shapeProblem
          ? ({ ok: false, problem: shapeProblem } as const)
          : resolveEndpoint(endpoint),
    [customTransport, endpoint, shapeProblem],
  );
  const activeTransport = useMemo<LumiSurveyTransport | undefined>(
    () =>
      customTransport ??
      (endpointResolution?.ok
        ? createEndpointTransport(endpointResolution.url)
        : undefined),
    [customTransport, endpointResolution],
  );
  const transportProblem =
    endpointResolution && !endpointResolution.ok
      ? endpointResolution.problem
      : undefined;
  // The ref keeps StrictMode's second effect run from logging the same
  // problem twice.
  const loggedTransportProblemRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (transportProblem === loggedTransportProblemRef.current) {
      return;
    }
    loggedTransportProblemRef.current = transportProblem;
    if (transportProblem) {
      console.error(describeMissingTransport(transportProblem));
    }
  }, [transportProblem]);

  const { answers, status, error, setAnswer, submit, reset, restartTimer } =
    useLumiSurveyState(
      {
        surveyId,
        questions,
        transport: activeTransport ?? MISSING_TRANSPORT,
        events,
        context: enrichedContext,
        surveyType,
      },
      source === "document-v1",
    );

  const documentVisibility = useMemo(
    () =>
      source === "document-v1"
        ? resolveDocumentVisibility(questions, answers, visibilityMetadata)
        : undefined,
    [source, questions, answers, visibilityMetadata],
  );

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
          questions: documentVisibility
            ? page.questions.filter((question) =>
                documentVisibility.visibleQuestionIds.has(question.id),
              )
            : getVisibleQuestions(page.questions, answers, visibilityMetadata),
        }))
        .filter((page) => page.questions.length > 0),
    [answers, documentVisibility, pages, visibilityMetadata],
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
    ? `${domIdPrefix}-${domKeys.page(headerPage?.id ?? "")}-page-heading`
    : `${domIdPrefix}-${domKeys.question(headerQuestion.id)}-dock-heading`;
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
      treeOf(rootRef.current).getElementById(promptHeadingId)?.focus();
    }
    prevShowIntroRef.current = showIntro;
  }, [showIntro, promptHeadingId]);

  // Move focus only after an explicit step-navigation action has rendered its
  // target question. Answer-driven visibility updates must not steal focus.
  useEffect(() => {
    if (!pendingStepFocusRef.current) return;
    pendingStepFocusRef.current = false;
    treeOf(rootRef.current).getElementById(promptHeadingId)?.focus();
  }, [promptHeadingId]);

  // Filter questions based on visibleIf conditions (progressive disclosure)
  const visibleQuestions = useMemo(
    () =>
      documentVisibility?.visibleQuestions ??
      getVisibleQuestions(questions, answers, visibilityMetadata),
    [documentVisibility, questions, answers, visibilityMetadata],
  );

  // Combined reset: clears survey answers, resets step navigation, and restores intro screen
  const handleFullReset = useCallback(() => {
    reset();
    resetNavigation();
    setStepValidationMissing([]);
    setValidationAttempt(0);
    setShowIntro(config.hasIntro && !skipIntro);
  }, [reset, resetNavigation, config.hasIntro, skipIntro]);

  const handleIntroStart = useCallback(() => {
    markUserInteraction();
    setShowIntro(false);
  }, [markUserInteraction]);

  // Progressive submit: hide the button until a currently visible question has
  // at least one meaningful answer. Required-answer validation happens on submit.
  const isSubmitBlocked = useMemo(
    () =>
      !shouldShowSubmitButton(
        questions,
        documentVisibility?.visibleAnswers ?? answers,
        visibilityMetadata,
      ),
    [documentVisibility, questions, answers, visibilityMetadata],
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
      return documentVisibility
        ? visited.filter((question) =>
            documentVisibility.visibleQuestionIds.has(question.id),
          )
        : getVisibleQuestions(visited, answers, visibilityMetadata);
    }
    // Non-step mode: only validate visible questions (hidden questions are
    // excluded regardless of whether they were previously visible).
    return visibleQuestions;
  }, [
    isStepMode,
    visitedSteps,
    documentVisibility,
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

  // Without a `<form>` the submit button calls this with no event.
  const handleSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      // React also passes on a submit from a form in a portal in the survey's
      // tree, such as a search in a dialog the app opens from the survey. That
      // form is the app's, and so is what happens when it is sent.
      if (event && event.target !== event.currentTarget) {
        return;
      }
      event?.preventDefault();
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

  const hasTransport = activeTransport !== undefined;
  // A document can hide every question from this user, for example with a
  // rule on the device. It then has nothing to ask. An intro must not be
  // shown either: its start button would lead to nothing, and the survey
  // would vanish under the user.
  const hasVisibleQuestions = visibleQuestions.length > 0;

  return {
    rootRef,
    userInSurvey,
    hasTransport,
    isViewable: hasTransport && (source === "legacy" || hasVisibleQuestions),
    isEmpty: source === "document-v1" && !hasVisibleQuestions && !isSuccess,
    status,
    isSuccess,
    showIntro,
    headerQuestion,
    questionDomKey: domKeys.question,
    introHeadingId,
    promptHeadingId,
    successHeadingId,
    reset: handleFullReset,
    restartTimer,
    panelProps: {
      panelId,
      panelLabel: "Gi tilbakemelding",
      panelClassName: config.panelClassName,
      panelBackground: config.panelBackground,
      panelBorderColor: config.panelBorderColor,
      promptQuestion: headerQuestion,
      headerTitle: headerPage?.title,
      headerDescription: promptDescription,
      successHeadingId,
      introHeadingId,
      onSubmit: handleSubmit,
      orderedQuestions: visibleQuestions,
      orderedPages: source === "document-v1" ? visiblePages : undefined,
      answers,
      validationMissing,
      validationAttempt,
      isSubmitting,
      submitLabel: config.submitLabel,
      submitPendingLabel: config.submitPendingLabel,
      cancelLabel: config.cancelLabel,
      showPersonalDataNotice,
      personalDataNotice: config.personalDataNotice,
      isSubmitBlocked,
      hasTransportError: Boolean(hasTransportError),
      transportErrorMessage: config.transportErrorMessage,
      onQuestionChange: handleQuestionChange,
      stepNavigation: {
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
      },
      progress: {
        showProgress: config.showProgress,
        totalSteps: totalVisibleSteps,
        hasBranching,
      },
      questionContext: {
        promptQuestionId,
        promptHeadingId,
        promptDescriptionId,
        promptDescriptionIsQuestionDescription,
        questionAnchorId,
        validationErrorMessage: config.validationErrorMessage,
        validationSummaryHeading: config.validationSummaryHeading,
        textTooLongErrorMessage: config.textTooLongErrorMessage,
      },
      intro: {
        isIntro: showIntro,
        introTitle: config.introTitle,
        introBody: config.introBody,
        introStartLabel: config.introStartLabel,
        onIntroStart: handleIntroStart,
      },
      success: {
        isSuccess,
        successTitle: config.successTitle,
        successBody: config.successBody,
        successPrimaryLabel: config.successPrimaryLabel,
      },
    },
  };
}

export interface SubmitFocusOptions {
  /** Called once when a submit has succeeded, before focus moves. */
  onSubmitted?: () => void;
  /**
   * Whether any part of the survey is on screen. When it is not, focus moves
   * without scrolling: a user who has moved down the page while a slow
   * submit was pending is not pulled back to the survey. Leave it out where
   * the survey cannot be scrolled away from.
   */
  isOnScreen?: () => boolean;
  /**
   * Return focus to the submit button when sending has failed. Browsers drop
   * focus from the button when it is disabled during the submit.
   */
  refocusSubmitOnError?: boolean;
}

/**
 * Keeps focus in the survey when a submit ends. On success it calls
 * `onSubmitted` and then moves focus to the receipt, when focus was in the
 * survey. It is a hook of its own because the dock runs it after it has read
 * its stored dismissal. `useSurveyFlow` cannot place an effect among the
 * effects of the component that calls it.
 *
 * A screen reader can press Send while focus stays on the page. Focus that is
 * still on the element it was on when the submit started has not been moved
 * by the user, so it counts as the survey's.
 */
export function useSubmitFocus(
  flow: Pick<
    SurveyFlow,
    "status" | "rootRef" | "userInSurvey" | "successHeadingId"
  >,
  options: SubmitFocusOptions = {},
): void {
  const { status, rootRef, userInSurvey, successHeadingId } = flow;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const previousStatusRef = useRef(status);
  const focusAtSubmitRef = useRef<(Element | null)[] | null>(null);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    const root = rootRef.current;
    if (status === "submitting") {
      if (previousStatus !== "submitting") {
        focusAtSubmitRef.current = focusPath(root);
      }
      return;
    }
    const focusAtSubmit = focusAtSubmitRef.current;
    focusAtSubmitRef.current = null;
    const focusIsUnmoved = () => {
      const now = focusPath(root);
      return Boolean(
        focusAtSubmit?.[0] &&
          now.length === focusAtSubmit.length &&
          now.every((element, index) => element === focusAtSubmit[index]),
      );
    };
    const focusIsLeftToSurvey = () => focusIsNowhere(root) || focusIsUnmoved();

    const { onSubmitted, isOnScreen, refocusSubmitOnError } =
      optionsRef.current;
    const focusOptions =
      isOnScreen && !isOnScreen() ? { preventScroll: true } : undefined;

    // A submit only fails after it has started, so this is a failed send and
    // not a validation error.
    if (previousStatus === "submitting" && status === "error") {
      if (
        refocusSubmitOnError &&
        userInSurvey.isIn() &&
        focusIsLeftToSurvey()
      ) {
        rootRef.current
          ?.querySelector<HTMLElement>(`[${SUBMIT_BUTTON_ATTRIBUTE}]`)
          ?.focus(focusOptions);
      }
      return;
    }

    const enteredSuccess = previousStatus !== "success" && status === "success";
    if (!enteredSuccess) {
      return;
    }

    onSubmitted?.();

    // Focus must still be in the survey, nowhere, as where a disabled submit
    // button leaves it, or where it was when the submit started. Focus the
    // user has moved to the page stays there.
    if (
      userInSurvey.isIn() &&
      (focusIsLeftToSurvey() || hasFocusInside(root))
    ) {
      treeOf(rootRef.current)
        .getElementById(successHeadingId)
        ?.focus(focusOptions);
    }
  }, [rootRef, status, successHeadingId, userInSurvey]);
}
