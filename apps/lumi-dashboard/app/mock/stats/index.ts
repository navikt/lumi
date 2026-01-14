/**
 * Stats module - re-exports for easy importing.
 *
 * Phase 2 of refactoring: modular stats calculation.
 * Each survey type has its own stats file that can be imported individually
 * or all at once through this index.
 *
 * Usage:
 * import { calculatePeriod, getMockTopTasksStats } from "~/mock/stats"
 */

// Common utilities and types
export {
  calculatePeriod,
  calculateFieldStats,
  type TextResponseWithTimestamp,
  // Re-exports from utils
  applyFeedbackFilters,
  type FilterParams,
  stemNorwegian,
  extractWords,
  STOP_WORDS,
  getTaskNameFromFeedback,
  getBlockerTextFromFeedback,
  getSuccessStatusFromFeedback,
  getDurationFromFeedback,
  TopTasksFieldIds,
} from "./common";

// Survey type stats
export { getMockTopTasksStats } from "./topTasks";
export { getMockDiscoveryStats } from "./discovery";
export { getMockBlockerStats } from "./blocker";
export { getMockTaskPriorityStats } from "./taskPriority";
// export { calculateStats } from "./overview";
