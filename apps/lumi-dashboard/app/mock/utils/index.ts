/**
 * Mock data utilities - re-exports for easy importing.
 *
 * Usage:
 * import { getTaskNameFromFeedback, stemNorwegian } from "~/mock/utils"
 */

// Field ID constants and extraction functions
export {
  TopTasksFieldIds,
  RatingFieldIds,
  getTaskNameFromFeedback,
  getRatingFromFeedback,
  getSuccessStatusFromFeedback,
  getBlockerTextFromFeedback,
  getDurationFromFeedback,
  getCommentFromFeedback,
} from "./extractors";

// Text analysis utilities
export {
  STOP_WORDS,
  stemNorwegian,
  matchesThemeKeywords,
  extractWords,
  extractStemmedWords,
} from "./textAnalysis";

// Filter utilities
export {
  type FilterParams,
  applyFeedbackFilters,
  toURLSearchParams,
} from "./filters";
