/**
 * Server Actions - Re-exports all server functions for convenient importing.
 *
 * @example
 * import { fetchStatsServerFn, fetchFeedbackServerFn } from "~/server/actions";
 */

// Delete
export { deleteFeedbackServerFn, deleteSurveyServerFn } from "./delete";
// Export
export { exportServerFn } from "./export";
// Blocker Patterns
export { fetchBlockerServerFn } from "./fetchBlocker";
// Context Tags
export { fetchContextTagsServerFn } from "./fetchContextTags";
// Discovery
export { fetchDiscoveryServerFn } from "./fetchDiscovery";
// Feedback
export { fetchFeedbackServerFn } from "./fetchFeedback";
// Filter Bootstrap
export { fetchFilterBootstrapServerFn } from "./fetchFilterBootstrap";
// Stats
export { fetchStatsServerFn } from "./fetchStats";
// Surveys
export { fetchSurveysByAppServerFn } from "./fetchSurveys";
// Task Priority
export { fetchTaskPriorityServerFn } from "./fetchTaskPriority";
// Top Tasks
export { fetchTopTasksServerFn } from "./fetchTopTasks";
// Markers
export {
  createMarkerServerFn,
  deleteMarkerServerFn,
  fetchMarkersServerFn,
  updateMarkerServerFn,
} from "./markers";
// Tags
export { addTagServerFn, fetchTagsServerFn, removeTagServerFn } from "./tags";
