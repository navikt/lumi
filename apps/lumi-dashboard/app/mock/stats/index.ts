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

export { getMockBlockerStats } from "./blocker";
// Common utilities and types
export {
  // Re-exports from utils
  applyFeedbackFilters,
  calculateFieldStats,
  calculatePeriod,
  extractWords,
  type FilterParams,
  getBlockerTextFromFeedback,
  getDurationFromFeedback,
  getSuccessStatusFromFeedback,
  getTaskIdFromFeedback,
  getTaskNameFromFeedback,
  STOP_WORDS,
  stemNorwegian,
  type TextResponseWithTimestamp,
  TopTasksFieldIds,
} from "./common";
export { getMockDiscoveryStats } from "./discovery";
export { getMockTaskPriorityStats } from "./taskPriority";
// Survey type stats
export { getMockTopTasksStats } from "./topTasks";
// export { calculateStats } from "./overview";
