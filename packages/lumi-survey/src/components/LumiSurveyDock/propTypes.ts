import type { BoxNewProps } from "@navikt/ds-react/Box";
import type { ReactNode } from "react";

/**
 * Labels for the Lumi survey widget UI elements.
 * All have sensible Norwegian defaults.
 */
export interface LumiSurveyLabels {
  /** Label for the submit button. @default "Send inn" */
  submit?: string;
  /** Label for submit button while submitting. @default "Sender inn..." */
  submitPending?: string;
  /** Label for the cancel button. @default "Lukk" */
  cancel?: string;
  /** Error message for validation failures. @default "Vennligst fyll ut alle påkrevde felt" */
  validationError?: string;
  /** Heading shown when multiple answers need correction. */
  validationSummary?: string;
  /** Error formatter for a text answer above its effective character limit. */
  textTooLong?: (maxLength: number) => string;
  /** Error message for transport failures. @default "Noe gikk galt ved innsending. Prøv igjen senere." */
  transportError?: string;
  /** Label for the minimized button. @default "Gi tilbakemelding" */
  minimizedButton?: string;
}

/**
 * Configuration for the success state after submission.
 */
export interface LumiSurveySuccessConfig {
  /** Title shown on success screen. @default "Takk for tilbakemeldingen!" */
  title?: string;
  /** Optional body content on success screen. */
  body?: ReactNode;
  /** Label for the primary button on success screen. @default "Lukk" */
  primaryLabel?: string;
  /** Auto-close after success. @default false */
  autoClose?: boolean;
  /** Delay before auto-close in ms. @default 1600 */
  autoCloseDelayMs?: number;
}

/**
 * Visual styling options for the dock panel.
 */
export interface LumiSurveyStyle {
  /** Position on screen. @default "bottom-right" */
  position?: "bottom-right" | "bottom-left";
  /** Offset from viewport edges in px. @default 24 */
  offset?: number;
  /** Additional CSS class for container. */
  containerClassName?: string;
  /** Additional CSS class for panel. */
  panelClassName?: string;
  /**
   * Max height for the open panel as a CSS value.
   * Intended for embedded previews inside a constrained stage.
   * @default "calc(100vh - 2rem)"
   */
  panelMaxHeight?: string;
  /** Panel background color (Aksel token). @default "default" */
  panelBackground?: BoxNewProps["background"];
  /** Panel border color (Aksel token). @default "neutral-subtle" */
  panelBorderColor?: BoxNewProps["borderColor"];
}

/**
 * Storage strategy for persistence (dismissal state).
 * - "consent": Use NAV decorator consent system (external pages like nav.no)
 * - "localStorage": Use localStorage directly (internal pages like Modia)
 * - "none": No persistence, always show based on initialOpen
 */
export type StorageStrategy = "consent" | "localStorage" | "none";

/**
 * Controls how questions are presented.
 * - "auto": authored pages become steps; legacy surveys use step mode only
 *   when branching logic exists (default)
 * - "singlePage": show all visible authored pages/questions on one surface
 * - "steps": compatibility override for flat legacy surveys. New surveys
 *   should express grouping and steps with `SurveyDocumentV1.pages` and leave
 *   this setting as "auto"
 */
export type QuestionLayout = "auto" | "singlePage" | "steps";

/**
 * Configuration for the intro screen shown before the first question.
 */
export interface LumiSurveyIntroConfig {
  /** Title shown on intro screen. */
  title: string;
  /** Optional body content on intro screen. */
  body?: ReactNode;
  /** Label for the start button. @default "Start" */
  startLabel?: string;
}

/**
 * Behavior options for the dock.
 */
export interface LumiSurveyBehavior {
  /** Whether dock starts open. @default true */
  initialOpen?: boolean;
  /** Reset form when closing. @default true */
  resetOnClose?: boolean;
  /** Days before dismissed dock reappears. @default 30 */
  dismissCooldownDays?: number;
  /** Hide completely after successful submit. @default true */
  hideAfterSubmit?: boolean;
  /**
   * Question layout mode.
   * @default "auto"
   */
  questionLayout?: QuestionLayout;
  /** Show privacy notice. @default true */
  showPersonalDataNotice?: boolean;
  /** Custom privacy notice content. */
  personalDataNotice?: ReactNode;

  /**
   * Opt-in: Auto-collect current pathname from `window.location.pathname`.
   * Default is `false` to avoid collecting identifiers from dynamic routes.
   */
  collectLocation?: boolean;
  /**
   * Storage strategy for persistence (dismissal state).
   * - "consent": Use NAV decorator consent system (external pages)
   * - "localStorage": Use localStorage directly (internal pages like Modia)
   * - "none": No persistence
   * @default "consent"
   */
  storageStrategy?: StorageStrategy;

  /**
   * Show progress from the first question in step mode when there are at least
   * two reachable steps, including visible step text above the indicator. Intro
   * and success screens are not counted as steps. Branching shows only the known
   * current step because its estimated total may change.
   * @default false
   */
  showProgress?: boolean;

  /**
   * Start navigation on the authored page with this id when it exists and is
   * visible; otherwise the survey starts on the first visible page. Intended
   * for embedded previews that mirror a specific page while authoring.
   */
  initialPageId?: string;

  /**
   * Simulate a viewport for embedded previews: the dock sizes itself from
   * this instead of the real window, and auto-collected `viewport`/
   * `deviceType` context reflects the simulation. Production behavior is
   * unchanged when unset.
   */
  simulatedViewport?: { width: number; height: number };
}
