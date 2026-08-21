/**
 * Common utilities for stats calculations.
 *
 * Provides shared types, period calculation, and re-exports filter utilities.
 */

import dayjs from "dayjs";
import type {
  FeedbackDto,
  FieldStat,
  FieldStats,
  FieldType,
} from "~/types/api";
import { extractTopKeywords } from "./phrases";

export {
  getBlockerTextFromFeedback,
  getDurationFromFeedback,
  getSuccessStatusFromFeedback,
  getTaskIdFromFeedback,
  getTaskNameFromFeedback,
  TopTasksFieldIds,
} from "../utils/extractors";
// Re-export filter utilities for convenience
export { applyFeedbackFilters, type FilterParams } from "../utils/filters";
export { stemNorwegian } from "../utils/textAnalysis";

// ============================================
// Types
// ============================================

/**
 * Text response with timestamp for recent responses display.
 */
export interface TextResponseWithTimestamp {
  text: string;
  submittedAt: string;
}

// ============================================
// Period Calculation
// ============================================

/**
 * Calculate date period with defaults (30 days if not specified).
 */
export function calculatePeriod(
  fromDate: string | null,
  toDate: string | null,
): { fromDate: string | null; toDate: string | null; days: number } {
  const today = dayjs();
  // Default to 30 days (start = today - 29 days)
  const defaultFrom = today.subtract(29, "day").format("YYYY-MM-DD");
  const defaultTo = today.format("YYYY-MM-DD");

  const actualFrom = fromDate || defaultFrom;
  const actualTo = toDate || defaultTo;

  const fromDayjs = dayjs(actualFrom);
  const toDayjs = dayjs(actualTo);

  // Diff in days + 1 for inclusive range
  const diffDays = toDayjs.diff(fromDayjs, "day") + 1;

  return {
    fromDate: actualFrom,
    toDate: actualTo,
    days: diffDays,
  };
}

// ============================================
// Field Stats Calculation
// ============================================

/**
 * Calculate statistics for each field across all feedback items.
 * Used for field-level breakdown in survey view.
 */
export function calculateFieldStats(items: FeedbackDto[]): FieldStat[] {
  // Collect all unique fields across all items
  const fieldMap = new Map<
    string,
    {
      fieldId: string;
      fieldType: FieldType;
      label: string;
      // For RATING
      ratingSum: number;
      ratingCount: number;
      ratingDistribution: Record<number, number>;
      // For SINGLE_CHOICE / MULTI_CHOICE
      optionCounts: Map<string, { label: string; count: number }>;
      totalChoices: number;
      // For TEXT
      textResponses: TextResponseWithTimestamp[];
      totalItems: number;
    }
  >();

  const totalItems = items.length;

  for (const item of items) {
    for (const answer of item.answers) {
      const key = answer.fieldId;

      if (!fieldMap.has(key)) {
        fieldMap.set(key, {
          fieldId: answer.fieldId,
          fieldType: answer.fieldType as FieldType,
          label: answer.question.label,
          ratingSum: 0,
          ratingCount: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          optionCounts: new Map(),
          totalChoices: 0,
          textResponses: [],
          totalItems,
        });
      }

      const field = fieldMap.get(key);
      if (!field) continue;

      switch (answer.fieldType) {
        case "RATING": {
          const rating = answer.value.rating;
          if (rating !== undefined) {
            field.ratingSum += rating;
            field.ratingCount++;
            field.ratingDistribution[rating] =
              (field.ratingDistribution[rating] || 0) + 1;
          }
          break;
        }

        case "SINGLE_CHOICE": {
          const selectedId = answer.value.selectedOptionId;
          if (selectedId) {
            const option = answer.question.options?.find(
              (o) => o.id === selectedId,
            );
            const label = option?.label || selectedId;
            const current = field.optionCounts.get(selectedId);
            if (current) {
              current.count++;
            } else {
              field.optionCounts.set(selectedId, { label, count: 1 });
            }
            field.totalChoices++;
          }
          break;
        }

        case "MULTI_CHOICE": {
          const selectedIds = answer.value.selectedOptionIds || [];
          for (const id of selectedIds) {
            const option = answer.question.options?.find((o) => o.id === id);
            const label = option?.label || id;
            const current = field.optionCounts.get(id);
            if (current) {
              current.count++;
            } else {
              field.optionCounts.set(id, { label, count: 1 });
            }
          }
          if (selectedIds.length > 0) {
            field.totalChoices++;
          }
          break;
        }

        case "TEXT": {
          const text = answer.value.text?.trim();
          if (text) {
            field.textResponses.push({
              text,
              submittedAt: item.submittedAt,
            });
          }
          break;
        }

        case "DATE": {
          // Date fields don't have specific stats yet
          break;
        }
      }
    }
  }

  // Convert to FieldStat array
  const result: FieldStat[] = [];

  for (const [, field] of fieldMap) {
    let stats: FieldStats;

    switch (field.fieldType) {
      case "RATING":
        stats = {
          type: "rating",
          average:
            field.ratingCount > 0 ? field.ratingSum / field.ratingCount : 0,
          distribution: field.ratingDistribution,
        };
        break;

      case "SINGLE_CHOICE":
      case "MULTI_CHOICE": {
        const totalSelections = Array.from(field.optionCounts.values()).reduce(
          (sum, option) => sum + option.count,
          0,
        );
        const distribution: Record<
          string,
          { label: string; count: number; percentage: number }
        > = {};
        for (const [id, data] of field.optionCounts) {
          distribution[id] = {
            label: data.label,
            count: data.count,
            percentage:
              field.totalChoices > 0
                ? Math.round((data.count / field.totalChoices) * 100)
                : 0,
          };
        }
        stats = {
          type: "choice",
          responseCount: field.totalChoices,
          responseRate: totalItems > 0 ? field.totalChoices / totalItems : 0,
          totalSelections,
          distribution,
        };
        break;
      }

      default: {
        const topKeywords = extractTopKeywords(
          field.textResponses.map((response) => response.text),
          10,
        );

        const recentResponses = field.textResponses
          .sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          )
          .slice(0, 10);

        stats = {
          type: "text",
          responseCount: field.textResponses.length,
          responseRate:
            field.totalItems > 0
              ? Math.round(
                  (field.textResponses.length / field.totalItems) * 100,
                )
              : 0,
          topKeywords,
          recentResponses,
        };
        break;
      }
    }

    result.push({
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      label: field.label,
      stats,
    });
  }

  return result;
}
