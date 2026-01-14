import type {
  DateAnswer,
  FeedbackDto,
  MultiChoiceAnswer,
  RatingAnswer,
  SingleChoiceAnswer,
  SubmissionContext,
  TextAnswer,
} from "~/types/api";

// ============================================
// Helper functions for creating answers
// ============================================

export function createRatingAnswer(
  fieldId: string,
  label: string,
  rating: number,
  description?: string,
): RatingAnswer {
  return {
    fieldId,
    fieldType: "RATING",
    question: { label, description },
    value: { type: "rating", rating },
  };
}

export function createTextAnswer(
  fieldId: string,
  label: string,
  text: string,
  description?: string,
): TextAnswer {
  return {
    fieldId,
    fieldType: "TEXT",
    question: { label, description },
    value: { type: "text", text },
  };
}

export function createSingleChoiceAnswer(
  fieldId: string,
  label: string,
  selectedOptionId: string,
  description?: string,
  options?: { id: string; label: string }[],
): SingleChoiceAnswer {
  return {
    fieldId,
    fieldType: "SINGLE_CHOICE",
    question: { label, description, options },
    value: { type: "singleChoice", selectedOptionId },
  };
}

export function createMultiChoiceAnswer(
  fieldId: string,
  label: string,
  selectedOptionIds: string[],
  description?: string,
  options?: { id: string; label: string }[],
): MultiChoiceAnswer {
  return {
    fieldId,
    fieldType: "MULTI_CHOICE",
    question: { label, description, options },
    value: { type: "multiChoice", selectedOptionIds },
  };
}

export function createDateAnswer(
  fieldId: string,
  label: string,
  date: string,
  description?: string,
): DateAnswer {
  return {
    fieldId,
    fieldType: "DATE",
    question: { label, description },
    value: { type: "date", date },
  };
}

// Helper for context with viewport dimensions
export function createContext(
  pathname: string,
  deviceType: "mobile" | "tablet" | "desktop" = "desktop",
  viewportWidth?: number,
  viewportHeight?: number,
): SubmissionContext {
  const defaultWidths = { mobile: 375, tablet: 768, desktop: 1440 };
  const defaultHeights = { mobile: 812, tablet: 1024, desktop: 900 };
  const width = viewportWidth || defaultWidths[deviceType];
  const height = viewportHeight || defaultHeights[deviceType];
  return {
    url: `https://www.nav.no${pathname}`,
    pathname,
    deviceType,
    viewportWidth: width,
    viewportHeight: height,
  };
}

// ============================================
// Helper functions for data analysis
// ============================================

export function getRating(item: FeedbackDto): number | null {
  const ratingAnswer = item.answers.find((a) => a.fieldType === "RATING");
  if (ratingAnswer && ratingAnswer.value.type === "rating") {
    return ratingAnswer.value.rating;
  }
  return null;
}

export function getTextResponses(item: FeedbackDto): string[] {
  return item.answers
    .filter(
      (a) => a.fieldType === "TEXT" && a.value.type === "text" && a.value.text,
    )
    .map((a) => (a.value as { type: "text"; text: string }).text);
}

export function hasTextResponse(item: FeedbackDto): boolean {
  return getTextResponses(item).length > 0;
}
