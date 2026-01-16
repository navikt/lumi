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
 * - "auto": step mode only when branching logic exists (default)
 * - "singlePage": always show all visible questions on one page
 * - "steps": always show one question at a time with Next/Back
 */
export type QuestionLayout = "auto" | "singlePage" | "steps";

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
   * Storage strategy for persistence (dismissal state).
   * - "consent": Use NAV decorator consent system (external pages)
   * - "localStorage": Use localStorage directly (internal pages like Modia)
   * - "none": No persistence
   * @default "consent"
   */
  storageStrategy?: StorageStrategy;
}
