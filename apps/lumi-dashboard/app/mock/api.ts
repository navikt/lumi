/**
 * Mock API - thin wrappers for mock data access.
 *
 * These functions mirror the real API functions but use mock data.
 * Import from here for consistent mock data access.
 *
 * Usage:
 * import { getMockStats, getMockFeedback } from "~/mock/api"
 */

import type {
  BlockerResponse,
  DiscoveryResponse,
  FeedbackPage,
  FeedbackStats,
  TaskPriorityResponse,
  TopTasksResponse,
} from "~/types/api";

import { calculateStats } from "./stats";
import {
  getMockBlockerStats,
  getMockDiscoveryStats,
  getMockTaskPriorityStats,
  getMockTopTasksStats,
} from "./stats";
import { mockFeedbackItems } from "./store";
import { applyFeedbackFilters } from "./utils/filters";

// Re-export store for convenience
export {
  mockFeedbackItems,
  getAllMockFeedback,
  getMockFeedbackByType,
} from "./store";

/**
 * Get mock stats with filtering.
 */
export function getMockStats(params: URLSearchParams): FeedbackStats {
  return calculateStats(mockFeedbackItems, params);
}

/**
 * Get mock Top Tasks stats with filtering.
 */
export function getMockTopTasks(params: URLSearchParams): TopTasksResponse {
  return getMockTopTasksStats(mockFeedbackItems, params);
}

/**
 * Get mock Discovery stats with filtering.
 */
export function getMockDiscovery(params: URLSearchParams): DiscoveryResponse {
  return getMockDiscoveryStats(mockFeedbackItems, params);
}

/**
 * Get mock Blocker stats with filtering.
 */
export function getMockBlockers(params: URLSearchParams): BlockerResponse {
  return getMockBlockerStats(mockFeedbackItems, params);
}

/**
 * Get mock Task Priority stats with filtering.
 */
export function getMockTaskPriority(
  params: URLSearchParams,
): TaskPriorityResponse {
  return getMockTaskPriorityStats(mockFeedbackItems, params);
}

/**
 * Get mock feedback page with filtering and pagination.
 */
export function getMockFeedbackPage(
  params: URLSearchParams,
  page = 0,
  size = 20,
): FeedbackPage {
  const filtered = applyFeedbackFilters(mockFeedbackItems, params);

  // Sort by submittedAt descending
  const sorted = [...filtered].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  const startIndex = page * size;
  const endIndex = startIndex + size;
  const content = sorted.slice(startIndex, endIndex);
  const totalPages = Math.ceil(sorted.length / size);

  return {
    content,
    totalPages,
    totalElements: sorted.length,
    size,
    number: page,
    hasNext: endIndex < sorted.length,
    hasPrevious: page > 0,
  };
}
