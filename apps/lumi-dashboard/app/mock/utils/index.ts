/**
 * Mock data utilities - re-exports for easy importing.
 *
 * Usage:
 * import { getTaskNameFromFeedback, stemNorwegian } from "~/mock/utils"
 */

// Field ID constants and extraction functions
export {
  getBlockerTextFromFeedback,
  getCommentFromFeedback,
  getDurationFromFeedback,
  getRatingFromFeedback,
  getSuccessStatusFromFeedback,
  getTaskIdFromFeedback,
  getTaskNameFromFeedback,
  RatingFieldIds,
  TopTasksFieldIds,
} from "./extractors";
// Filter utilities
export {
  applyFeedbackFilters,
  type FilterParams,
  toURLSearchParams,
} from "./filters";
// Text analysis utilities
export { matchesThemeKeywords, stemNorwegian } from "./textAnalysis";
