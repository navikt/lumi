import type { ReactNode } from "react";
import {
  DEFAULT_COPY,
  DEFAULT_PERSONAL_DATA_NOTICE,
} from "../shared/commonDefaults.js";
import type {
  LumiSurveyBehavior,
  LumiSurveyIntroConfig,
  LumiSurveyLabels,
  LumiSurveyStyle,
  LumiSurveySuccessConfig,
} from "./propTypes.js";

/**
 * Resolved configuration combining user props with defaults.
 */
export interface ResolvedConfig {
  // Labels
  submitLabel: string;
  submitPendingLabel: string;
  cancelLabel: string;
  validationErrorMessage: string;
  transportErrorMessage: string;
  minimizedButtonLabel: string;

  // Success
  successTitle: string;
  successBody: ReactNode;
  successPrimaryLabel: string;
  autoCloseOnSuccess: boolean;
  successCloseDelayMs: number;

  // Style
  position: "bottom-right" | "bottom-left";
  offset: number;
  containerClassName?: string;
  panelClassName?: string;
  panelBackground?: LumiSurveyStyle["panelBackground"];
  panelBorderColor?: LumiSurveyStyle["panelBorderColor"];
  panelMaxHeight: string;

  // Behavior
  initialOpen: boolean;
  resetOnClose: boolean;
  dismissCooldownDays: number;
  hideAfterSubmit: boolean;
  questionLayout: "auto" | "singlePage" | "steps";
  showPersonalDataNotice: boolean;
  personalDataNotice: ReactNode;
  collectLocation: boolean;
  storageStrategy: "consent" | "localStorage" | "none";
  showProgress: boolean;
  initialPageId?: string;
  simulatedViewport?: { width: number; height: number };

  // Intro
  introTitle?: string;
  introBody?: ReactNode;
  introStartLabel: string;
  hasIntro: boolean;
}

/**
 * Resolves LumiSurveyDock configuration by applying defaults to optional props.
 */
export function resolveConfig(
  labels?: LumiSurveyLabels,
  success?: LumiSurveySuccessConfig,
  style?: LumiSurveyStyle,
  behavior?: LumiSurveyBehavior,
  intro?: LumiSurveyIntroConfig,
): ResolvedConfig {
  return {
    // Labels
    submitLabel: labels?.submit ?? DEFAULT_COPY.submitLabel,
    submitPendingLabel:
      labels?.submitPending ?? DEFAULT_COPY.submitPendingLabel,
    cancelLabel: labels?.cancel ?? DEFAULT_COPY.cancelLabel,
    validationErrorMessage:
      labels?.validationError ?? DEFAULT_COPY.validationErrorMessage,
    transportErrorMessage:
      labels?.transportError ?? DEFAULT_COPY.transportErrorMessage,
    minimizedButtonLabel: labels?.minimizedButton ?? "Gi tilbakemelding",

    // Success
    successTitle: success?.title ?? DEFAULT_COPY.successTitle,
    successBody: success?.body ?? DEFAULT_COPY.successBody,
    successPrimaryLabel:
      success?.primaryLabel ?? DEFAULT_COPY.successPrimaryLabel,
    autoCloseOnSuccess: success?.autoClose ?? false,
    successCloseDelayMs: success?.autoCloseDelayMs ?? 1600,

    // Style
    position: style?.position ?? "bottom-right",
    offset: style?.offset ?? 24,
    containerClassName: style?.containerClassName,
    panelClassName: style?.panelClassName,
    panelBackground: style?.panelBackground ?? "default",
    panelBorderColor: style?.panelBorderColor ?? "neutral-subtle",
    panelMaxHeight: style?.panelMaxHeight ?? "calc(100vh - 2rem)",

    // Behavior
    initialOpen: behavior?.initialOpen ?? true,
    resetOnClose: behavior?.resetOnClose ?? true,
    dismissCooldownDays: behavior?.dismissCooldownDays ?? 30,
    hideAfterSubmit: behavior?.hideAfterSubmit ?? true,
    questionLayout: behavior?.questionLayout ?? "auto",
    showPersonalDataNotice: behavior?.showPersonalDataNotice ?? true,
    personalDataNotice:
      behavior?.personalDataNotice ?? DEFAULT_PERSONAL_DATA_NOTICE,
    collectLocation: behavior?.collectLocation ?? false,
    storageStrategy: behavior?.storageStrategy ?? "consent",
    showProgress: behavior?.showProgress ?? false,
    initialPageId: behavior?.initialPageId,
    simulatedViewport: behavior?.simulatedViewport,

    // Intro
    introTitle: intro?.title,
    introBody: intro?.body,
    introStartLabel: intro?.startLabel ?? "Start",
    hasIntro: intro != null,
  };
}
