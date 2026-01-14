/**
 * Field ID constants and extraction functions for mock data.
 *
 * These utilities provide a single source of truth for field IDs and
 * extract structured data from FeedbackDto items.
 */

import type { FeedbackDto } from "~/types/api";

// ============================================
// Field ID Constants (mirrors backend TopTasksFieldIds)
// ============================================

/**
 * Known field IDs for Top Tasks survey answers.
 * Matches the backend TopTasksFieldIds object in Models.kt.
 */
export const TopTasksFieldIds = {
  task: ["task", "category"] as const,
  success: ["taskSuccess", "success"] as const,
  blocker: ["blocker", "hindring"] as const,
  duration: ["duration", "tid"] as const,
} as const;

/**
 * Known field IDs for Rating survey answers.
 */
export const RatingFieldIds = {
  rating: ["rating", "vurdering"] as const,
  comment: ["comment", "text", "feedback"] as const,
} as const;

// ============================================
// Extraction Functions
// ============================================

/**
 * Extract task name from a Top Tasks feedback item.
 * Returns null if the item is not a Top Tasks survey or has no task answer.
 */
export function getTaskNameFromFeedback(item: FeedbackDto): string | null {
  if (item.surveyType !== "topTasks") return null;

  const taskAnswer = item.answers.find((a) =>
    TopTasksFieldIds.task.includes(
      a.fieldId as (typeof TopTasksFieldIds.task)[number],
    ),
  );

  if (!taskAnswer || taskAnswer.fieldType !== "SINGLE_CHOICE") return null;

  const selectedId = taskAnswer.value.selectedOptionId;
  const option = taskAnswer.question.options?.find((o) => o.id === selectedId);

  return option?.label ?? selectedId ?? null;
}

/**
 * Extract rating value (1-5) from a feedback item.
 * Returns null if no rating answer is found.
 */
export function getRatingFromFeedback(item: FeedbackDto): number | null {
  const ratingAnswer = item.answers.find(
    (a) =>
      RatingFieldIds.rating.includes(
        a.fieldId as (typeof RatingFieldIds.rating)[number],
      ) && a.fieldType === "RATING",
  );

  if (!ratingAnswer || ratingAnswer.fieldType !== "RATING") return null;

  return ratingAnswer.value.rating ?? null;
}

/**
 * Extract success status from a Top Tasks feedback item.
 * Returns null if the item is not a Top Tasks survey or has no success answer.
 */
export function getSuccessStatusFromFeedback(
  item: FeedbackDto,
): "yes" | "partial" | "no" | null {
  if (item.surveyType !== "topTasks") return null;

  const successAnswer = item.answers.find((a) =>
    TopTasksFieldIds.success.includes(
      a.fieldId as (typeof TopTasksFieldIds.success)[number],
    ),
  );

  if (!successAnswer || successAnswer.fieldType !== "SINGLE_CHOICE")
    return null;

  const selectedId = successAnswer.value.selectedOptionId;
  const option = successAnswer.question.options?.find(
    (o) => o.id === selectedId,
  );
  const value = (option?.label ?? selectedId)?.toLowerCase();

  if (value?.includes("ja") || value?.includes("yes")) return "yes";
  if (value?.includes("del") || value?.includes("partial")) return "partial";
  if (value?.includes("nei") || value?.includes("no")) return "no";

  return null;
}

/**
 * Extract blocker text from a Top Tasks feedback item.
 * Returns null if the item is not a Top Tasks survey or has no blocker answer.
 */
export function getBlockerTextFromFeedback(item: FeedbackDto): string | null {
  if (item.surveyType !== "topTasks") return null;

  const blockerAnswer = item.answers.find((a) =>
    TopTasksFieldIds.blocker.includes(
      a.fieldId as (typeof TopTasksFieldIds.blocker)[number],
    ),
  );

  if (!blockerAnswer || blockerAnswer.fieldType !== "TEXT") return null;

  const text = blockerAnswer.value.text?.trim();
  return text && text.length > 0 ? text : null;
}

/**
 * Extract duration in milliseconds from a Top Tasks feedback item.
 * Returns null if the item is not a Top Tasks survey or has no duration answer.
 */
export function getDurationFromFeedback(item: FeedbackDto): number | null {
  if (item.surveyType !== "topTasks") return null;

  const durationAnswer = item.answers.find((a) =>
    TopTasksFieldIds.duration.includes(
      a.fieldId as (typeof TopTasksFieldIds.duration)[number],
    ),
  );

  if (!durationAnswer) return null;

  // Duration is typically stored as text (ms) in Top Tasks
  if (durationAnswer.fieldType === "TEXT") {
    const parsed = Number.parseInt(durationAnswer.value.text ?? "", 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Extract comment text from a feedback item.
 * Works for any survey type that has a text comment field.
 */
export function getCommentFromFeedback(item: FeedbackDto): string | null {
  const commentAnswer = item.answers.find(
    (a) =>
      RatingFieldIds.comment.includes(
        a.fieldId as (typeof RatingFieldIds.comment)[number],
      ) && a.fieldType === "TEXT",
  );

  if (!commentAnswer || commentAnswer.fieldType !== "TEXT") return null;

  const text = commentAnswer.value.text?.trim();
  return text && text.length > 0 ? text : null;
}
