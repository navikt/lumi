import type { LumiSurveyQuestion, SurveyType } from "../core/types.js";

export type { SurveyType };

/**
 * Configuration for a Lumi survey.
 * Questions are displayed in array order.
 * Use `visibleIf` on individual questions for progressive disclosure.
 */
export interface LumiSurveyConfig {
  /**
   * Survey type for analytics categorization.
   * Determines how the dashboard displays and aggregates results.
   * @default "custom"
   */
  type?: SurveyType;

  /**
   * All questions to display, in order.
   * The first question is rendered prominently in the dock header.
   * Use `visibleIf` on subsequent questions for progressive disclosure.
   */
  questions: LumiSurveyQuestion[];
}
