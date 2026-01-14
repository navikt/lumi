import type { FeedbackDto } from "~/types/api";

/**
 * Common color tokens for feedback UI elements.
 * Uses CSS variables from Aksel design system.
 */
export const COLORS = {
  iconWarning: "var(--ax-icon-warning)",
  iconInfo: "var(--ax-icon-info)",
  iconSuccess: "var(--ax-icon-success)",
  iconError: "var(--ax-icon-error)",
};

/**
 * Converts device type to an emoji icon.
 */
export function deviceToIcon(deviceType: string): string {
  switch (deviceType) {
    case "mobile":
      return "📱";
    case "tablet":
      return "📱";
    case "desktop":
      return "🖥️";
    default:
      return "❓";
  }
}

/**
 * Converts a rating (1-5) to a descriptive emoji.
 */
export function ratingToEmoji(rating: number): string {
  switch (rating) {
    case 1:
      return "😢";
    case 2:
      return "😕";
    case 3:
      return "😐";
    case 4:
      return "🙂";
    case 5:
      return "😄";
    default:
      return "❓";
  }
}

/**
 * Extracts all rating answers from feedback.
 * Returns array of {rating, label} for display.
 */
export function getAllRatings(
  feedback: FeedbackDto,
): { rating: number; label: string }[] {
  return feedback.answers
    .filter((a) => a.fieldType === "RATING" && a.value.type === "rating")
    .map((a) => ({
      rating: (a.value as { type: "rating"; rating: number }).rating,
      label: a.question.label,
    }));
}

/**
 * Gets main text content from feedback for preview/copy.
 * Prioritizes text answers, falls back to choice selections.
 */
export function getMainTextPreview(feedback: FeedbackDto): string | null {
  // Find first text answer with non-empty content
  const textAnswer = feedback.answers.find(
    (a) =>
      a.fieldType === "TEXT" &&
      a.value.type === "text" &&
      a.value.text.trim().length > 0,
  );

  if (textAnswer && textAnswer.value.type === "text") {
    return textAnswer.value.text;
  }

  return null;
}

/**
 * Gets a smart preview for feedback based on answer types.
 * Returns {text, subText} for two-line display.
 */
export function getFeedbackPreview(
  feedback: FeedbackDto,
): { text: string; subText?: string } | null {
  const textAnswers = feedback.answers.filter(
    (a) =>
      a.fieldType === "TEXT" &&
      a.value.type === "text" &&
      a.value.text.trim().length > 0,
  );

  if (textAnswers.length > 0) {
    const mainText = (textAnswers[0].value as { type: "text"; text: string })
      .text;
    const label = textAnswers[0].question.label;
    return {
      text: mainText,
      subText: label !== mainText ? label : undefined,
    };
  }

  // For choice answers, show selected option
  const choiceAnswer = feedback.answers.find(
    (a) => a.fieldType === "SINGLE_CHOICE" && a.value.type === "singleChoice",
  );

  if (choiceAnswer && choiceAnswer.value.type === "singleChoice") {
    const selectedId = choiceAnswer.value.selectedOptionId;
    const option = choiceAnswer.question.options?.find(
      (o) => o.id === selectedId,
    );
    return {
      text: option?.label || selectedId,
      subText: choiceAnswer.question.label,
    };
  }

  return null;
}

/**
 * Formats a camelCase key to readable label.
 * e.g., "harDialogmote" -> "Har Dialogmote"
 */
export function formatMetadataKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Formats boolean-like metadata values to Norwegian.
 */
export function formatMetadataValue(value: string): string {
  if (value === "true") return "Ja";
  if (value === "false") return "Nei";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
