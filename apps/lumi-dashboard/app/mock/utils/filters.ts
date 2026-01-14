/**
 * Unified filter utilities for mock data.
 *
 * Provides a single implementation of feedback filtering logic,
 * replacing the duplicated applyFilters and applyFiltersToItems functions.
 */

import type { FeedbackDto } from "~/types/api";
import { getTaskNameFromFeedback } from "./extractors";

// ============================================
// Filter Parameters Interface
// ============================================

/**
 * Filter parameters for feedback queries.
 * These can come from URLSearchParams or be passed directly.
 */
export interface FilterParams {
  app?: string;
  surveyId?: string;
  fromDate?: string;
  toDate?: string;
  deviceType?: string;
  segment?: string;
  task?: string;
  hasText?: string;
  lowRating?: string;
  theme?: string;
}

// ============================================
// Core Filter Function
// ============================================

/**
 * Apply filters to a list of feedback items.
 * Single source of truth for all filtering logic.
 *
 * @param items - The feedback items to filter
 * @param params - Filter parameters (from URL or direct)
 * @returns Filtered feedback items
 */
export function applyFeedbackFilters(
  items: FeedbackDto[],
  params: FilterParams | URLSearchParams,
): FeedbackDto[] {
  // Normalize params to FilterParams object
  const filters = normalizeParams(params);

  let filtered = [...items];

  // App filter
  if (filters.app) {
    filtered = filtered.filter((item) => item.app === filters.app);
  }

  // Survey ID filter
  if (filters.surveyId) {
    filtered = filtered.filter((item) => item.surveyId === filters.surveyId);
  }

  // Date range filters
  if (filters.fromDate) {
    const fromDate = filters.fromDate;
    filtered = filtered.filter((item) => item.submittedAt >= fromDate);
  }
  if (filters.toDate) {
    const toDate = filters.toDate;
    filtered = filtered.filter(
      (item) => item.submittedAt <= `${toDate}T23:59:59Z`,
    );
  }

  // Device type filter
  if (filters.deviceType) {
    filtered = filtered.filter(
      (item) => item.context?.deviceType === filters.deviceType,
    );
  }

  // Segment filter (format: "key:value,key:value")
  if (filters.segment) {
    const segmentFilters = filters.segment.split(",").map((t) => {
      const [key, value] = t.split(":");
      return { key, value };
    });
    filtered = filtered.filter((item) => {
      if (!item.metadata) return false;
      return segmentFilters.every(
        (filter) => item.metadata?.[filter.key] === filter.value,
      );
    });
  }

  // Task filter (for Top Tasks drill-down)
  if (filters.task) {
    filtered = filtered.filter((item) => {
      const taskName = getTaskNameFromFeedback(item);
      return taskName === filters.task;
    });
  }

  // Text filter (has text response)
  if (filters.hasText === "true") {
    filtered = filtered.filter((item) =>
      item.answers.some((a) => a.fieldType === "TEXT" && a.value.text?.trim()),
    );
  }

  // Low rating filter (1-2)
  if (filters.lowRating === "true") {
    filtered = filtered.filter((item) =>
      item.answers.some(
        (a) => a.fieldType === "RATING" && (a.value.rating ?? 3) <= 2,
      ),
    );
  }

  return filtered;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize filter parameters from URLSearchParams or FilterParams object.
 */
function normalizeParams(params: FilterParams | URLSearchParams): FilterParams {
  if (params instanceof URLSearchParams) {
    return {
      app: params.get("app") ?? undefined,
      surveyId: params.get("surveyId") ?? undefined,
      fromDate: params.get("fromDate") ?? undefined,
      toDate: params.get("toDate") ?? undefined,
      deviceType: params.get("deviceType") ?? undefined,
      segment: params.get("segment") ?? undefined,
      task: params.get("task") ?? undefined,
      hasText: params.get("hasText") ?? undefined,
      lowRating: params.get("lowRating") ?? undefined,
      theme: params.get("theme") ?? undefined,
    };
  }
  return params;
}

/**
 * Convert FilterParams to URLSearchParams.
 * Useful for testing.
 */
export function toURLSearchParams(params: FilterParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}
