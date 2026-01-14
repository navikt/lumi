/**
 * Server Actions - Re-exports all server functions for convenient importing.
 *
 * @example
 * import { fetchStatsServerFn, fetchFeedbackServerFn } from "~/server/actions";
 */

// Stats
export { fetchStatsServerFn } from "./fetchStats";

// Feedback
export { fetchFeedbackServerFn } from "./fetchFeedback";

// Top Tasks
export { fetchTopTasksServerFn } from "./fetchTopTasks";

// Discovery
export { fetchDiscoveryServerFn } from "./fetchDiscovery";

// Blocker Patterns
export { fetchBlockerServerFn } from "./fetchBlocker";

// Task Priority
export { fetchTaskPriorityServerFn } from "./fetchTaskPriority";

// Surveys
export { fetchSurveysByAppServerFn } from "./fetchSurveys";

// Tags
export { addTagServerFn, fetchTagsServerFn, removeTagServerFn } from "./tags";

// Context Tags
export { fetchContextTagsServerFn } from "./fetchContextTags";

// Delete
export { deleteFeedbackServerFn, deleteSurveyServerFn } from "./delete";

// Export
export { exportServerFn } from "./export";

// Filter Bootstrap
export { fetchFilterBootstrapServerFn } from "./fetchFilterBootstrap";
