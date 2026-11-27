import type { ReactNode } from "react";
import type { LumiSurveyStyle } from "../LumiSurveyDock/propTypes.js";

/**
 * Visual styling options for an inline survey. Its width follows the
 * container it is placed in.
 */
export interface LumiSurveyInlineStyle {
  /** Additional CSS class for the container. */
  containerClassName?: string;
  /** Additional CSS class for the panel. */
  panelClassName?: string;
  /** Panel background color (Aksel token). @default "default" */
  panelBackground?: LumiSurveyStyle["panelBackground"];
  /** Panel border color (Aksel token). @default "neutral-subtle" */
  panelBorderColor?: LumiSurveyStyle["panelBorderColor"];
}

/**
 * Behavior options for an inline survey. It has no options for opening,
 * closing or storage: it is always shown where it is placed, and it stores
 * nothing in the browser.
 */
export interface LumiSurveyInlineBehavior {
  /**
   * How the pages are shown.
   * - "auto": a document with several pages shows one page at a time
   *   (default)
   * - "singlePage": all visible pages at once
   * @default "auto"
   */
  questionLayout?: "auto" | "singlePage";
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
   * Show progress when the pages are shown one at a time. Linear surveys with
   * at least two steps show a progress bar and an exact total. Branching
   * surveys show only the current step. Intro and success screens are not
   * counted as steps.
   * @default false
   */
  showProgress?: boolean;
  /**
   * Start on the authored page with this id when it exists and is visible;
   * otherwise the survey starts on the first visible page. The intro is then
   * skipped. Intended for previews that mirror a specific page while
   * authoring.
   */
  initialPageId?: string;
  /**
   * Simulate a viewport for embedded previews: questions shown only on some
   * devices or viewport sizes follow this size and not the real window, and
   * the auto-collected `viewport` and `deviceType` context reflects it. The
   * width of the survey still follows its container. Production behavior is
   * unchanged when unset.
   */
  simulatedViewport?: { width: number; height: number };
}
